import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import {
  CashFlowMonth,
  DocumentCycle,
  estadoDe,
  estadoTexto,
  etapaActual,
  formatCLP,
  formatFecha,
  formatFechaOrGuion,
  Invoice,
  nombreMes,
  saldoFinal,
} from '../lib/format';

// Una fila genérica de "tabla" — cada celda tiene un ancho fijo para que las
// columnas queden alineadas cuando hay scroll horizontal.
function Fila({ celdas, encabezado }: { celdas: { texto: string; ancho: number; color?: string }[]; encabezado?: boolean }) {
  return (
    <View style={[styles.fila, encabezado && styles.filaEncabezado]}>
      {celdas.map((c, i) => (
        <Text
          key={i}
          style={[
            styles.celda,
            { width: c.ancho, color: c.color ?? (encabezado ? colors.greenLight : colors.white) },
            encabezado && styles.celdaEncabezado,
          ]}
          numberOfLines={1}
        >
          {c.texto}
        </Text>
      ))}
    </View>
  );
}

function Tabla({ titulo, filas, children }: { titulo: string; filas: number; children: React.ReactNode }) {
  return (
    <View style={styles.tablaCard}>
      <View style={styles.tablaHead}>
        <Text style={styles.tablaTitulo}>{titulo}</Text>
        <Text style={styles.tablaN}>{filas} filas</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View>{children}</View>
      </ScrollView>
    </View>
  );
}

export default function ExcelScreen({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meses, setMeses] = useState<CashFlowMonth[]>([]);
  const [ciclos, setCiclos] = useState<DocumentCycle[]>([]);

  async function cargar() {
    const [{ data: inv }, { data: cash }, { data: doc }] = await Promise.all([
      supabase.from('invoices').select('*').eq('client_id', userId).order('fecha_emision', { ascending: false }),
      supabase.from('cash_flow_months').select('*').eq('client_id', userId).order('mes', { ascending: true }),
      supabase.from('document_cycle').select('*').eq('client_id', userId).order('fecha_oc', { ascending: false }),
    ]);
    setInvoices((inv as Invoice[]) ?? []);
    setMeses((cash as CashFlowMonth[]) ?? []);
    setCiclos((doc as DocumentCycle[]) ?? []);
  }

  useEffect(() => {
    cargar().finally(() => setLoading(false));
  }, [userId]);

  async function onRefresh() {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        <Text style={styles.title}>Excel</Text>
        <Text style={styles.subtitle}>
          Los mismos datos de tu planilla, en una tabla limpia. Deslizá cada tabla hacia los costados para ver todas
          las columnas.
        </Text>

        <Tabla titulo="Cuentas por cobrar" filas={invoices.length}>
          <Fila
            encabezado
            celdas={[
              { texto: 'Cliente', ancho: 130 },
              { texto: 'N° Factura', ancho: 90 },
              { texto: 'Monto', ancho: 100 },
              { texto: 'Emisión', ancho: 90 },
              { texto: 'Estado', ancho: 90 },
            ]}
          />
          {invoices.map((inv) => {
            const estado = estadoDe(inv);
            return (
              <Fila
                key={inv.id}
                celdas={[
                  { texto: inv.cliente_nombre, ancho: 130 },
                  { texto: inv.numero_factura ?? '—', ancho: 90 },
                  { texto: formatCLP(inv.monto), ancho: 100 },
                  { texto: formatFecha(inv.fecha_emision), ancho: 90 },
                  {
                    texto: estadoTexto[estado],
                    ancho: 90,
                    color: estado === 'vencida' ? colors.red : estado === 'pagada' ? colors.greenLight : colors.yellow,
                  },
                ]}
              />
            );
          })}
          {invoices.length === 0 && <Text style={styles.empty}>Sin datos.</Text>}
        </Tabla>

        <Tabla titulo="Flujo de caja" filas={meses.length}>
          <Fila
            encabezado
            celdas={[
              { texto: 'Mes', ancho: 70 },
              { texto: 'Saldo inicial', ancho: 100 },
              { texto: 'Ingresos', ancho: 100 },
              { texto: 'Egresos', ancho: 100 },
              { texto: 'Saldo final', ancho: 100 },
            ]}
          />
          {meses.map((mes, i) => (
            <Fila
              key={i}
              celdas={[
                { texto: nombreMes(mes.mes), ancho: 70 },
                { texto: formatCLP(mes.saldo_inicial), ancho: 100 },
                { texto: formatCLP(mes.otros_ingresos), ancho: 100 },
                { texto: formatCLP(mes.egresos_fijos + mes.egresos_variables), ancho: 100 },
                { texto: formatCLP(saldoFinal(mes)), ancho: 100, color: colors.greenLight },
              ]}
            />
          ))}
          {meses.length === 0 && <Text style={styles.empty}>Sin datos.</Text>}
        </Tabla>

        <Tabla titulo="Ciclo documental" filas={ciclos.length}>
          <Fila
            encabezado
            celdas={[
              { texto: 'Cliente', ancho: 120 },
              { texto: 'N° OC', ancho: 80 },
              { texto: 'OC', ancho: 85 },
              { texto: 'HES', ancho: 85 },
              { texto: 'EDP', ancho: 85 },
              { texto: 'Factura', ancho: 85 },
              { texto: 'Etapa actual', ancho: 110 },
            ]}
          />
          {ciclos.map((c) => (
            <Fila
              key={c.id}
              celdas={[
                { texto: c.cliente_nombre, ancho: 120 },
                { texto: c.numero_oc ?? '—', ancho: 80 },
                { texto: formatFechaOrGuion(c.fecha_oc), ancho: 85 },
                { texto: formatFechaOrGuion(c.fecha_hes), ancho: 85 },
                { texto: formatFechaOrGuion(c.fecha_edp), ancho: 85 },
                { texto: formatFechaOrGuion(c.fecha_factura), ancho: 85 },
                { texto: etapaActual(c), ancho: 110, color: colors.greenLight },
              ]}
            />
          ))}
          {ciclos.length === 0 && <Text style={styles.empty}>Sin datos.</Text>}
        </Tabla>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { color: colors.white, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: colors.muted2, fontSize: 11.5, lineHeight: 16, marginBottom: 18 },
  tablaCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tablaHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tablaTitulo: { color: colors.white, fontSize: 13, fontWeight: '700' },
  tablaN: { color: colors.muted2, fontSize: 10.5 },
  fila: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 4 },
  filaEncabezado: { backgroundColor: '#1c2118' },
  celda: { fontSize: 11, paddingVertical: 8, paddingHorizontal: 10 },
  celdaEncabezado: { fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase' },
  empty: { color: colors.muted2, fontSize: 11, padding: 14 },
});
