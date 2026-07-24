// Edge Function: predict-payments (v2)
//
// Recalcula, para cada factura pendiente de cobro, la fecha probable de pago real,
// un nivel de riesgo y una explicación corta. Enfoque híbrido:
//   1) estadística por deudor (atraso ponderado por recencia, tendencia, variabilidad),
//      con fallback a la cartera de la pyme, luego al rubro, luego al plazo pactado;
//   2) auto-calibración: mide el error de las predicciones anteriores contra los pagos
//      reales ya registrados y corrige el sesgo sistemático en las predicciones nuevas
//      (así el sistema "aprende" con cada pago que entra, sin entrenar ningún modelo);
//   3) ciclo documental como señal: documentos trabados (OC/HES/EDP sin avanzar)
//      suben el riesgo del deudor;
//   4) razonamiento de Claude sobre todo eso + estacionalidad + contexto macro
//      (mindicador.cl). Si la llamada al LLM falla, cae a un cálculo estadístico puro
//      para que la funcionalidad nunca quede sin predicciones.
//
// Cada corrida INSERTA filas nuevas en payment_predictions (histórico append-only);
// la app lee la vista payment_predictions_latest.
//
// Invocación: POST con header "x-predict-secret" (== env PREDICT_SECRET).
// Body opcional: { "client_id": "<uuid>" } para recalcular solo una empresa
// (lo usan los triggers de invoices y document_cycle); sin body recalcula todas (cron).
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const LLM_MODEL = "claude-sonnet-5";
const MODEL_VERSION_LLM = "hybrid-sonnet-v2";
const MODEL_VERSION_STAT = "stat-fallback-v2";
// Peso de recencia: un pago de hace 180 días pesa la mitad que uno de hoy.
const HALF_LIFE_DAYS = 180;

type InvoiceRow = {
  id: string;
  client_id: string;
  cliente_nombre: string;
  monto: number;
  fecha_emision: string;
  plazo_dias: number;
  fecha_real_pago: string | null;
};

type ProfileRow = { id: string; company_type: string | null; company_name: string | null };

type CycleRow = {
  client_id: string;
  cliente_nombre: string;
  numero_oc: string | null;
  fecha_oc: string | null;
  fecha_hes: string | null;
  fecha_edp: string | null;
  fecha_factura: string | null;
  fecha_pago: string | null;
};

type DelayStats = {
  n: number;
  atraso_promedio: number;
  atraso_ponderado: number;
  desviacion: number;
  tendencia: "mejorando" | "empeorando" | "estable" | "sin_datos";
  atraso_facturas_grandes: number | null;
  atraso_facturas_chicas: number | null;
  monto_mediana: number | null;
};

// Precisión de predicciones pasadas: error_promedio_dias > 0 = veníamos
// prediciendo demasiado temprano (el pago real llegó después de lo estimado).
type Calibration = { n: number; error_promedio_dias: number };

type CycleSignal = { numero_oc: string | null; etapa: string; dias_en_etapa: number };

type Prediction = {
  invoice_id: string;
  predicted_payment_date: string;
  risk_score: number;
  risk_level: "bajo" | "medio" | "alto";
  confidence: "alta" | "media" | "baja";
  explanation: string;
  factors: string[];
};

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso + "T00:00:00Z");
  const b = Date.parse(toIso + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normName(name: string): string {
  return name.trim().toLowerCase();
}

function delayOf(inv: InvoiceRow): number {
  return daysBetween(inv.fecha_emision, inv.fecha_real_pago!) - inv.plazo_dias;
}

function computeStats(paid: InvoiceRow[], today: string): DelayStats {
  if (paid.length === 0) {
    return {
      n: 0,
      atraso_promedio: 0,
      atraso_ponderado: 0,
      desviacion: 0,
      tendencia: "sin_datos",
      atraso_facturas_grandes: null,
      atraso_facturas_chicas: null,
      monto_mediana: null,
    };
  }
  const rows = paid
    .map((inv) => ({ atraso: delayOf(inv), fecha: inv.fecha_real_pago!, monto: Number(inv.monto) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const avg = rows.reduce((s, r) => s + r.atraso, 0) / rows.length;

  let wSum = 0;
  let wTotal = 0;
  for (const r of rows) {
    const age = Math.max(0, daysBetween(r.fecha, today));
    const w = Math.pow(0.5, age / HALF_LIFE_DAYS);
    wSum += r.atraso * w;
    wTotal += w;
  }
  const weighted = wTotal > 0 ? wSum / wTotal : avg;

  const variance = rows.reduce((s, r) => s + (r.atraso - avg) ** 2, 0) / rows.length;
  const stddev = Math.sqrt(variance);

  let tendencia: DelayStats["tendencia"] = "sin_datos";
  if (rows.length >= 4) {
    const mid = Math.floor(rows.length / 2);
    const oldAvg = rows.slice(0, mid).reduce((s, r) => s + r.atraso, 0) / mid;
    const newAvg = rows.slice(mid).reduce((s, r) => s + r.atraso, 0) / (rows.length - mid);
    const diff = newAvg - oldAvg;
    tendencia = diff <= -3 ? "mejorando" : diff >= 3 ? "empeorando" : "estable";
  } else if (rows.length >= 2) {
    tendencia = "estable";
  }

  let atrasoGrandes: number | null = null;
  let atrasoChicas: number | null = null;
  let mediana: number | null = null;
  if (rows.length >= 5) {
    const byMonto = [...rows].sort((a, b) => a.monto - b.monto);
    mediana = byMonto[Math.floor(byMonto.length / 2)].monto;
    const chicas = byMonto.filter((r) => r.monto < mediana!);
    const grandes = byMonto.filter((r) => r.monto >= mediana!);
    if (chicas.length > 0) atrasoChicas = chicas.reduce((s, r) => s + r.atraso, 0) / chicas.length;
    if (grandes.length > 0) atrasoGrandes = grandes.reduce((s, r) => s + r.atraso, 0) / grandes.length;
  }

  const round1 = (x: number) => Math.round(x * 10) / 10;
  return {
    n: rows.length,
    atraso_promedio: round1(avg),
    atraso_ponderado: round1(weighted),
    desviacion: round1(stddev),
    tendencia,
    atraso_facturas_grandes: atrasoGrandes === null ? null : round1(atrasoGrandes),
    atraso_facturas_chicas: atrasoChicas === null ? null : round1(atrasoChicas),
    monto_mediana: mediana,
  };
}

// Etapa más avanzada con fecha cargada + hace cuántos días está trabado ahí.
function cycleSignal(c: CycleRow, today: string): CycleSignal | null {
  if (c.fecha_pago) return null; // ya cobrado, no es señal de riesgo
  const etapas: Array<[string, string | null]> = [
    ["Facturado", c.fecha_factura],
    ["EDP emitido", c.fecha_edp],
    ["HES emitida", c.fecha_hes],
    ["OC emitida", c.fecha_oc],
  ];
  for (const [etapa, fecha] of etapas) {
    if (fecha) {
      return { numero_oc: c.numero_oc, etapa, dias_en_etapa: Math.max(0, daysBetween(fecha, today)) };
    }
  }
  return null;
}

async function fetchMacro(): Promise<Record<string, unknown> | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch("https://mindicador.cl/api", { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const pick = (key: string) =>
      data[key] ? { valor: data[key].valor, fecha: String(data[key].fecha).slice(0, 10), unidad: data[key].unidad_medida } : null;
    return {
      fuente: "mindicador.cl (Banco Central de Chile)",
      ipc_mensual: pick("ipc"),
      tpm: pick("tpm"),
      imacec: pick("imacec"),
      tasa_desempleo: pick("tasa_desempleo"),
      dolar: pick("dolar"),
    };
  } catch (_) {
    return null;
  }
}

// --- Fallback estadístico puro (sin LLM) ---
function statisticalPrediction(
  inv: InvoiceRow,
  debtor: DelayStats,
  portfolio: DelayStats,
  sector: DelayStats | null,
  calibration: Calibration | null,
  cycleIssues: CycleSignal[],
  today: string,
): Prediction {
  let baseDelay: number;
  let source: string;
  let confidence: Prediction["confidence"];

  if (debtor.n >= 2) {
    baseDelay = debtor.atraso_ponderado;
    source = `historial del deudor (${debtor.n} pagos)`;
    confidence = debtor.n >= 4 ? "alta" : "media";
  } else if (portfolio.n >= 3) {
    baseDelay = portfolio.atraso_ponderado;
    source = `promedio de la cartera (${portfolio.n} pagos)`;
    confidence = "baja";
  } else if (sector && sector.n >= 3) {
    baseDelay = sector.atraso_ponderado;
    source = `promedio del rubro (${sector.n} pagos)`;
    confidence = "baja";
  } else {
    baseDelay = 0;
    source = "plazo pactado (sin historial)";
    confidence = "baja";
  }

  const factors = [source];

  // Auto-calibración: si veníamos errando sistemáticamente (p.ej. prediciendo
  // 5 días demasiado temprano), corregimos las predicciones nuevas en esa dirección.
  let bias = 0;
  if (calibration && calibration.n >= 3) {
    bias = Math.max(-30, Math.min(30, Math.round(calibration.error_promedio_dias)));
    if (bias !== 0) factors.push("ajuste por precisión de predicciones anteriores");
  }

  const due = addDays(inv.fecha_emision, inv.plazo_dias);
  let predicted = addDays(due, Math.round(baseDelay) + bias);
  // Si la fecha estimada ya pasó y la factura sigue impaga, la corremos hacia adelante.
  if (predicted < today) predicted = addDays(today, 7);

  const overdueDays = Math.max(0, daysBetween(due, today));
  const excessOverdue = Math.max(0, overdueDays - Math.max(0, baseDelay));
  let score = 15;
  score += Math.min(35, Math.max(0, baseDelay) * 1.2);
  score += Math.min(30, excessOverdue * 1.5);
  const stats = debtor.n >= 2 ? debtor : portfolio.n >= 3 ? portfolio : sector ?? debtor;
  score += Math.min(15, (stats?.desviacion ?? 0) * 0.5);
  if (stats?.tendencia === "empeorando") score += 8;
  if (stats?.tendencia === "mejorando") score -= 8;

  // Ciclo documental trabado (>21 días sin avanzar de etapa) = riesgo extra.
  const stuck = cycleIssues.filter((c) => c.dias_en_etapa > 21);
  if (stuck.length > 0) {
    score += Math.min(12, stuck.length * 6);
    factors.push(`documentos trabados (${stuck[0].etapa} hace ${stuck[0].dias_en_etapa} días)`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: Prediction["risk_level"] = score >= 60 ? "alto" : score >= 35 ? "medio" : "bajo";

  if (overdueDays > 0) factors.push(`ya vencida hace ${overdueDays} días`);
  if (stats?.tendencia === "empeorando" || stats?.tendencia === "mejorando") factors.push(`tendencia ${stats.tendencia}`);

  const atrasoTxt =
    Math.round(baseDelay) > 0
      ? `suele pagar con ${Math.round(baseDelay)} días de atraso`
      : Math.round(baseDelay) < 0
        ? `suele pagar ${Math.abs(Math.round(baseDelay))} días antes del plazo`
        : "suele pagar dentro del plazo";
  const explanation =
    `Estimación según ${source}: ${atrasoTxt}.` +
    (bias !== 0 ? ` Se ajustó ${Math.abs(bias)} días según la precisión de estimaciones anteriores.` : "") +
    (overdueDays > 0 ? ` La factura ya lleva ${overdueDays} días vencida, lo que sube el riesgo.` : "") +
    (stuck.length > 0 ? ` Además hay documentos del deudor sin avanzar hace más de 3 semanas.` : "");

  return {
    invoice_id: inv.id,
    predicted_payment_date: predicted,
    risk_score: score,
    risk_level: level,
    confidence,
    explanation,
    factors: factors.slice(0, 4),
  };
}

// --- Llamada a Claude ---
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["predictions"],
  properties: {
    predictions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "invoice_id",
          "predicted_payment_date",
          "risk_score",
          "risk_level",
          "confidence",
          "explanation",
          "factors",
        ],
        properties: {
          invoice_id: { type: "string" },
          predicted_payment_date: { type: "string", format: "date" },
          risk_score: { type: "integer" },
          risk_level: { enum: ["bajo", "medio", "alto"] },
          confidence: { enum: ["alta", "media", "baja"] },
          explanation: { type: "string" },
          factors: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `Sos un analista financiero especializado en cuentas por cobrar de pymes chilenas.
Recibís, para una empresa, sus facturas pendientes de cobro junto con estadísticas ya calculadas
del comportamiento de pago de cada deudor, de la cartera completa, del rubro, la precisión de las
predicciones anteriores del sistema, el estado del ciclo documental de cada deudor, e indicadores
macroeconómicos de Chile.

Para CADA factura pendiente tenés que estimar:
- predicted_payment_date: la fecha más probable en que se va a pagar de verdad (formato YYYY-MM-DD).
  Nunca puede ser anterior a la fecha de hoy. Partí del vencimiento (fecha_emision + plazo_dias)
  ajustado por el atraso típico del deudor, dando más peso al atraso ponderado por recencia que al
  promedio simple, y considerá la tendencia (mejorando/empeorando) y la estacionalidad chilena
  (cierres de año en diciembre-enero y vacaciones de febrero suelen estirar los pagos).
- risk_score: 0 a 100. Riesgo de que el pago se atrase significativamente más de lo normal para ese
  deudor, o de que no se cobre. Considerá: atraso ya acumulado si está vencida, variabilidad
  (un deudor errático es más riesgoso que uno consistente aunque el promedio sea igual),
  tendencia, monto (si las facturas grandes de ese deudor se pagan distinto que las chicas),
  y ciclo documental trabado (una OC/HES/EDP sin avanzar hace semanas anticipa demora en el pago).
- risk_level: bajo (0-34), medio (35-59), alto (60-100). Tiene que ser coherente con el score.
- confidence: alta si hay historial abundante del deudor específico (4+ pagos), media con historial
  parcial (2-3 pagos), baja si la estimación se basa en la cartera, el rubro o solo el plazo pactado.
- explanation: 1 a 3 frases en español simple y directo, explicando QUÉ factores pesaron en la
  estimación, para que el dueño de la pyme entienda el número. Sin jerga estadística:
  "suele pagar con ~12 días de atraso", no "media ponderada".
- factors: lista corta (1 a 4) de etiquetas de los factores que realmente pesaron, p.ej.
  "historial del deudor", "vencida hace 15 días", "documentos trabados", "estacionalidad de fin de año".

Sobre precision_predicciones: es el error de las predicciones anteriores del sistema contra los
pagos reales (positivo = veníamos prediciendo demasiado temprano, el pago llegó después). Si hay un
sesgo sistemático con muestras suficientes (n >= 3), corregilo en tus estimaciones nuevas.

Sobre los indicadores macroeconómicos: usalos SOLO si identificás un impacto real y concreto para
el caso (p.ej. TPM muy alta encareciendo el crédito y estirando cadenas de pago). Si no hay un
efecto claro, NO ajustes nada por macro y no lo menciones en la explicación. No inventes.

Devolvé una predicción por cada factura pendiente recibida, usando exactamente su invoice_id.`;

async function llmPredictions(
  anthropic: Anthropic,
  payload: unknown,
  pendingIds: Set<string>,
): Promise<Prediction[] | null> {
  const resp = await anthropic.messages.create({
    model: LLM_MODEL,
    max_tokens: 16000,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });

  if (resp.stop_reason === "refusal" || resp.stop_reason === "max_tokens") return null;
  const textBlock = resp.content.find((b: { type: string }) => b.type === "text") as
    | { type: "text"; text: string }
    | undefined;
  if (!textBlock) return null;

  const parsed = JSON.parse(textBlock.text) as { predictions: Prediction[] };
  const today = todayIso();
  const out: Prediction[] = [];
  for (const p of parsed.predictions ?? []) {
    if (!pendingIds.has(p.invoice_id)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.predicted_payment_date)) continue;
    const score = Math.max(0, Math.min(100, Math.round(p.risk_score)));
    out.push({
      ...p,
      risk_score: score,
      predicted_payment_date: p.predicted_payment_date < today ? today : p.predicted_payment_date,
      factors: Array.isArray(p.factors) ? p.factors.slice(0, 6) : [],
    });
  }
  return out.length > 0 ? out : null;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("PREDICT_SECRET");
  if (!secret || req.headers.get("x-predict-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let onlyClientId: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.client_id === "string") onlyClientId = body.client_id;
  } catch (_) {
    // sin body => recalcular todo
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const anthropic = new Anthropic({
    apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    timeout: 120_000,
  });

  // Todo de una: facturas y perfiles para stats propias y por rubro, ciclo documental
  // como señal de riesgo, y últimas predicciones para la auto-calibración.
  const [
    { data: invoices, error: invErr },
    { data: profiles, error: profErr },
    { data: cycles },
    { data: latestPreds },
  ] = await Promise.all([
    supabase.from("invoices").select("id, client_id, cliente_nombre, monto, fecha_emision, plazo_dias, fecha_real_pago"),
    // Sin filtrar por role: si un admin cargó facturas propias, también se predicen.
    supabase.from("profiles").select("id, company_type, company_name"),
    supabase.from("document_cycle").select("client_id, cliente_nombre, numero_oc, fecha_oc, fecha_hes, fecha_edp, fecha_factura, fecha_pago"),
    supabase.from("payment_predictions_latest").select("invoice_id, client_id, predicted_payment_date"),
  ]);
  if (invErr || profErr) {
    return new Response(JSON.stringify({ error: (invErr ?? profErr)!.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const allInvoices = (invoices ?? []) as InvoiceRow[];
  const allProfiles = (profiles ?? []) as ProfileRow[];
  const allCycles = (cycles ?? []) as CycleRow[];
  const today = todayIso();
  const macro = await fetchMacro();

  // Auto-calibración: error de la última predicción de cada factura YA pagada
  // (positivo = el pago real llegó después de lo predicho => veníamos optimistas).
  const invoiceById = new Map(allInvoices.map((i) => [i.id, i]));
  const errorsByClient = new Map<string, number[]>();
  const errorsByDebtor = new Map<string, number[]>();
  for (const pred of (latestPreds ?? []) as Array<{ invoice_id: string; client_id: string; predicted_payment_date: string }>) {
    const inv = invoiceById.get(pred.invoice_id);
    if (!inv || !inv.fecha_real_pago) continue;
    const error = daysBetween(pred.predicted_payment_date, inv.fecha_real_pago);
    errorsByClient.set(pred.client_id, [...(errorsByClient.get(pred.client_id) ?? []), error]);
    const dKey = `${pred.client_id}:${normName(inv.cliente_nombre)}`;
    errorsByDebtor.set(dKey, [...(errorsByDebtor.get(dKey) ?? []), error]);
  }
  const calibrationOf = (errors: number[] | undefined): Calibration | null => {
    if (!errors || errors.length === 0) return null;
    const avg = errors.reduce((s, e) => s + e, 0) / errors.length;
    return { n: errors.length, error_promedio_dias: Math.round(avg * 10) / 10 };
  };

  const typeOf = new Map(allProfiles.map((p) => [p.id, p.company_type]));
  const targets = allProfiles.filter((p) => (onlyClientId ? p.id === onlyClientId : true));

  let totalPredictions = 0;
  const llmFailures: string[] = [];

  for (const profile of targets) {
    const own = allInvoices.filter((i) => i.client_id === profile.id);
    const pending = own.filter((i) => !i.fecha_real_pago);
    if (pending.length === 0) continue;

    const paid = own.filter((i) => i.fecha_real_pago);
    const portfolioStats = computeStats(paid, today);
    const clientCalibration = calibrationOf(errorsByClient.get(profile.id));

    // Stats por deudor (cliente_nombre normalizado) dentro de la cartera de esta pyme.
    const paidByDebtor = new Map<string, InvoiceRow[]>();
    for (const inv of paid) {
      const key = normName(inv.cliente_nombre);
      paidByDebtor.set(key, [...(paidByDebtor.get(key) ?? []), inv]);
    }
    const debtorStats = new Map<string, DelayStats>();
    for (const [key, rows] of paidByDebtor) debtorStats.set(key, computeStats(rows, today));

    // Ciclo documental sin cobrar, agrupado por deudor: etapa actual + días trabado.
    const cyclesByDebtor = new Map<string, CycleSignal[]>();
    for (const c of allCycles.filter((c) => c.client_id === profile.id)) {
      const sig = cycleSignal(c, today);
      if (!sig) continue;
      const key = normName(c.cliente_nombre);
      cyclesByDebtor.set(key, [...(cyclesByDebtor.get(key) ?? []), sig]);
    }

    // Rubro: facturas pagadas de OTRAS empresas del mismo company_type.
    let sectorStats: DelayStats | null = null;
    if (profile.company_type) {
      const sectorPaid = allInvoices.filter(
        (i) =>
          i.fecha_real_pago &&
          i.client_id !== profile.id &&
          typeOf.get(i.client_id) === profile.company_type,
      );
      if (sectorPaid.length >= 3) sectorStats = computeStats(sectorPaid, today);
    }

    const payload = {
      hoy: today,
      moneda: "CLP",
      empresa: { rubro: profile.company_type ?? "desconocido" },
      indicadores_macro_chile: macro,
      precision_predicciones: {
        nota: "error en días de predicciones anteriores vs pago real; positivo = prediccion fue demasiado temprana",
        empresa: clientCalibration,
        por_deudor: Object.fromEntries(
          [...errorsByDebtor.entries()]
            .filter(([k]) => k.startsWith(profile.id + ":"))
            .map(([k, v]) => [k.split(":")[1], calibrationOf(v)]),
        ),
      },
      ciclo_documental_por_deudor: Object.fromEntries(cyclesByDebtor.entries()),
      estadisticas: {
        nota: "atrasos en días; positivo = paga tarde, negativo = paga antes del plazo. atraso_ponderado da más peso a los pagos recientes.",
        cartera_completa: portfolioStats,
        rubro: sectorStats,
        por_deudor: Object.fromEntries(debtorStats.entries()),
      },
      facturas_pendientes: pending.map((inv) => {
        const due = addDays(inv.fecha_emision, inv.plazo_dias);
        return {
          invoice_id: inv.id,
          deudor: inv.cliente_nombre,
          deudor_key: normName(inv.cliente_nombre),
          monto: Number(inv.monto),
          fecha_emision: inv.fecha_emision,
          plazo_dias: inv.plazo_dias,
          fecha_vencimiento: due,
          dias_vencida: Math.max(0, daysBetween(due, today)),
        };
      }),
    };

    const statFor = (inv: InvoiceRow): Prediction => {
      const dKey = normName(inv.cliente_nombre);
      const debtorCal = calibrationOf(errorsByDebtor.get(`${profile.id}:${dKey}`));
      return statisticalPrediction(
        inv,
        debtorStats.get(dKey) ?? computeStats([], today),
        portfolioStats,
        sectorStats,
        debtorCal && debtorCal.n >= 3 ? debtorCal : clientCalibration,
        cyclesByDebtor.get(dKey) ?? [],
        today,
      );
    };

    const pendingIds = new Set(pending.map((i) => i.id));
    let predictions: Prediction[] | null = null;
    let modelVersion = MODEL_VERSION_LLM;
    try {
      predictions = await llmPredictions(anthropic, payload, pendingIds);
    } catch (err) {
      llmFailures.push(`${profile.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!predictions) {
      modelVersion = MODEL_VERSION_STAT;
      predictions = pending.map(statFor);
    }

    // Completar con fallback estadístico las facturas que el LLM haya omitido.
    const covered = new Set(predictions.map((p) => p.invoice_id));
    for (const inv of pending) {
      if (!covered.has(inv.id)) predictions.push(statFor(inv));
    }

    const rows = predictions.map((p) => {
      const inv = pending.find((i) => i.id === p.invoice_id)!;
      const dKey = normName(inv.cliente_nombre);
      return {
        invoice_id: p.invoice_id,
        client_id: profile.id,
        predicted_payment_date: p.predicted_payment_date,
        risk_score: p.risk_score,
        risk_level: p.risk_level,
        confidence: p.confidence,
        explanation: p.explanation,
        factors: p.factors,
        model_version: covered.has(p.invoice_id) ? modelVersion : MODEL_VERSION_STAT,
        inputs_snapshot: {
          hoy: today,
          deudor_stats: debtorStats.get(dKey) ?? null,
          cartera_stats: portfolioStats,
          rubro_stats: sectorStats,
          calibracion_empresa: clientCalibration,
          calibracion_deudor: calibrationOf(errorsByDebtor.get(`${profile.id}:${dKey}`)),
          ciclo_documental: cyclesByDebtor.get(dKey) ?? [],
          macro,
        },
      };
    });

    const { error: insertErr } = await supabase.from("payment_predictions").insert(rows);
    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    totalPredictions += rows.length;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      clients_processed: targets.length,
      predictions_inserted: totalPredictions,
      llm_failures: llmFailures,
      macro_available: macro !== null,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
