// Funciones de formato compartidas entre pantallas (montos, fechas, estado de facturas).

export type Invoice = {
  id: string;
  cliente_nombre: string;
  numero_factura: string | null;
  monto: number;
  fecha_emision: string;
  plazo_dias: number;
  fecha_real_pago: string | null;
};

export type CashFlowMonth = {
  id?: string;
  mes: string;
  saldo_inicial: number;
  cobros_esperados: number;
  otros_ingresos: number;
  egresos_fijos: number;
  egresos_variables: number;
};

export function formatCLP(monto: number) {
  return '$' + Math.round(monto).toLocaleString('es-CL');
}

export function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export function addDias(iso: string, dias: number) {
  const fecha = new Date(iso + 'T00:00:00');
  fecha.setDate(fecha.getDate() + dias);
  return fecha;
}

export function estadoDe(inv: Invoice): 'pendiente' | 'pagada' | 'vencida' {
  if (inv.fecha_real_pago) return 'pagada';
  const vence = addDias(inv.fecha_emision, inv.plazo_dias);
  return vence < new Date() ? 'vencida' : 'pendiente';
}

// Días de atraso desde el vencimiento hasta hoy (0 si todavía no vence o ya está pagada).
export function diasAtraso(inv: Invoice) {
  if (estadoDe(inv) !== 'vencida') return 0;
  const vence = addDias(inv.fecha_emision, inv.plazo_dias);
  const ms = new Date().getTime() - vence.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function saldoFinal(mes: CashFlowMonth) {
  return (
    mes.saldo_inicial + mes.cobros_esperados + mes.otros_ingresos - mes.egresos_fijos - mes.egresos_variables
  );
}

export const estadoColorKey = {
  pendiente: 'yellow',
  pagada: 'greenLight',
  vencida: 'red',
} as const;

export const estadoTexto: Record<string, string> = {
  pendiente: 'Pendiente',
  pagada: 'Pagada',
  vencida: 'Vencida',
};

export function nombreMes(iso: string) {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const [, m] = iso.split('-');
  return meses[parseInt(m, 10) - 1];
}

export type DocumentCycle = {
  id: string;
  cliente_nombre: string;
  numero_oc: string | null;
  fecha_oc: string | null;
  fecha_hes: string | null;
  fecha_edp: string | null;
  fecha_factura: string | null;
  fecha_pago: string | null;
};

// Devuelve la etapa más avanzada que ya tiene fecha cargada.
export function etapaActual(ciclo: DocumentCycle) {
  if (ciclo.fecha_pago) return 'Pagado';
  if (ciclo.fecha_factura) return 'Facturado';
  if (ciclo.fecha_edp) return 'EDP emitido';
  if (ciclo.fecha_hes) return 'HES emitida';
  if (ciclo.fecha_oc) return 'OC emitida';
  return 'Sin iniciar';
}

export function formatFechaOrGuion(iso: string | null) {
  return iso ? formatFecha(iso) : '—';
}

// Días transcurridos desde que se completó el último paso (o sea, hace cuánto está
// "trabado" en la etapa actual). null si ya está pagado o si todavía no arrancó nada
// (no hay ninguna fecha de referencia para contar los días).
export function diasEnEtapaActual(ciclo: DocumentCycle): number | null {
  const etapa = etapaActual(ciclo);
  if (etapa === 'Pagado' || etapa === 'Sin iniciar') return null;

  const fechaReferencia =
    etapa === 'Facturado'
      ? ciclo.fecha_factura
      : etapa === 'EDP emitido'
        ? ciclo.fecha_edp
        : etapa === 'HES emitida'
          ? ciclo.fecha_hes
          : ciclo.fecha_oc; // 'OC emitida'

  if (!fechaReferencia) return null;
  const ms = new Date().getTime() - new Date(fechaReferencia + 'T00:00:00').getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Una entrada del historial de planillas Excel subidas por el cliente.
export type ExcelUpload = {
  id: string;
  file_name: string;
  uploaded_at: string;
};

export function formatFechaHora(iso: string) {
  const fecha = new Date(iso);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const yyyy = fecha.getFullYear();
  const hh = String(fecha.getHours()).padStart(2, '0');
  const min = String(fecha.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

// --- Proyección de saldo a 30 días ---
//
// La idea: no usar directamente el "Cobros Esperados" que el cliente carga a mano en el
// Excel (es una estimación suya, marcada con "*" en la plantilla), sino calcular nosotros
// cuánto va a cobrar en los próximos 30 días a partir de:
//   1) las facturas pendientes reales (invoices) y sus plazos, y
//   2) cuánto atraso tiene ESE cliente en la práctica (comparando, en las facturas ya
//      pagadas, la fecha real de pago contra el plazo pactado).
// El resto (otros ingresos / egresos fijos y variables) no tiene detalle factura por
// factura, así que se prorratea día a día a partir de lo cargado en Flujo de Caja.

function isoAMes(iso: string) {
  return iso.slice(0, 7); // "YYYY-MM"
}

function diasEntreISO(desde: string, hasta: string) {
  const a = new Date(desde + 'T00:00:00').getTime();
  const b = new Date(hasta + 'T00:00:00').getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function diasEnMes(anio: number, mes: number) {
  return new Date(anio, mes, 0).getDate(); // mes en base 1 (1=enero)
}

export type ProyeccionSaldo = {
  saldo: number | null;
  atrasoPromedioDias: number;
};

export function saldoProyectado30(
  invoices: Invoice[],
  meses: CashFlowMonth[],
  hoy: Date = new Date()
): ProyeccionSaldo {
  if (meses.length === 0) return { saldo: null, atrasoPromedioDias: 0 };

  const mesHoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const mesActual = meses.find((m) => isoAMes(m.mes) === mesHoyISO) ?? meses[meses.length - 1];

  // 1) Atraso histórico promedio de pago (días reales de pago menos el plazo pactado,
  // sobre las facturas que ya se pagaron). Positivo = paga tarde, negativo = paga antes.
  const pagadas = invoices.filter((inv) => inv.fecha_real_pago);
  const atrasoPromedio =
    pagadas.length > 0
      ? pagadas.reduce(
          (acc, inv) => acc + (diasEntreISO(inv.fecha_emision, inv.fecha_real_pago!) - inv.plazo_dias),
          0
        ) / pagadas.length
      : 0;

  // 2) Saldo "de hoy": saldo inicial del mes + lo que ya se cobró de verdad este mes +
  // la parte de otros ingresos/egresos que ya "pasó" según cuántos días del mes ya corrieron
  // (en vez de usar el mes completo, que asumiría que ya terminó).
  const [anioMesActual, numMesActual] = mesActual.mes.split('-').map(Number);
  const diasDelMesActual = diasEnMes(anioMesActual, numMesActual);
  const inicioMesActual = new Date(anioMesActual, numMesActual - 1, 1);
  const diasTranscurridos = Math.min(
    diasDelMesActual,
    Math.max(1, Math.floor((hoy.getTime() - inicioMesActual.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  );
  const fraccionMesTranscurrido = diasTranscurridos / diasDelMesActual;

  const cobradoEsteMes = invoices
    .filter((inv) => inv.fecha_real_pago && isoAMes(inv.fecha_real_pago) === mesActual.mes.slice(0, 7))
    .reduce((acc, inv) => acc + inv.monto, 0);

  const saldoHoy =
    mesActual.saldo_inicial +
    cobradoEsteMes +
    fraccionMesTranscurrido * (mesActual.otros_ingresos - mesActual.egresos_fijos - mesActual.egresos_variables);

  // 3) Proyección de los próximos 30 días desde hoy.
  const finVentana = new Date(hoy);
  finVentana.setDate(finVentana.getDate() + 30);

  const cobrosEsperadosAjustados = invoices
    .filter((inv) => !inv.fecha_real_pago)
    .reduce((acc, inv) => {
      const fechaEsperada = addDias(inv.fecha_emision, inv.plazo_dias + Math.round(atrasoPromedio));
      return fechaEsperada >= hoy && fechaEsperada <= finVentana ? acc + inv.monto : acc;
    }, 0);

  let otrosIngresosVentana = 0;
  let egresosVentana = 0;
  for (let d = 0; d < 30; d++) {
    const dia = new Date(hoy);
    dia.setDate(dia.getDate() + d);
    const mesDelDia = meses.find((m) => isoAMes(m.mes) === `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}`);
    if (mesDelDia) {
      const totalDiasMes = diasEnMes(dia.getFullYear(), dia.getMonth() + 1);
      otrosIngresosVentana += mesDelDia.otros_ingresos / totalDiasMes;
      egresosVentana += (mesDelDia.egresos_fijos + mesDelDia.egresos_variables) / totalDiasMes;
    }
  }

  const saldo = saldoHoy + cobrosEsperadosAjustados + otrosIngresosVentana - egresosVentana;
  return { saldo, atrasoPromedioDias: Math.round(atrasoPromedio) };
}
