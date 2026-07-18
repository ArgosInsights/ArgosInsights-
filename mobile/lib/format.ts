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
