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

export function saldoFinal(mes: CashFlowMonth) {
  return mes.saldo_inicial + mes.otros_ingresos - mes.egresos_fijos - mes.egresos_variables;
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
