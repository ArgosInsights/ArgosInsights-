import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../components/Text';
import InvoiceDetailModal from '../components/InvoiceDetailModal';
import PressableScale from '../components/PressableScale';
import { ColorPalette } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  addDias,
  CashFlowMonth,
  DocumentCycle,
  estadoDe,
  etapaActual,
  formatCLP,
  formatFecha,
  Invoice,
  nombreMes,
  saldoFinal,
} from '../lib/format';

export default function HomeScreen({
  userId,
  email,
  navigation,
}: {
  userId: string;
  email: string;
  navigation: { navigate: (nombre: string) => void };
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const etapaColor: Record<string, string> = {
    'Sin iniciar': colors.muted2,
    'OC emitida': colors.yellow,
    'HES emitida': colors.yellow,
    'EDP emitido': colors.yellow,
    Facturado: colors.greenLight,
    Pagado: colors.greenLight,
  };
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nombreSaludo, setNombreSaludo] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ciclos, setCiclos] = useState<DocumentCycle[]>([]);
  const [meses, setMeses] = useState<CashFlowMonth[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [seleccionada, setSeleccionada] = useState<Invoice | null>(null);

  async function cargarDatos() {
    setErrorMsg(null);

    const [{ data: profile }, { data: invoicesData, error: invError }, { data: cashData }, { data: ciclosData }] =
      await Promise.all([
        supabase.from('profiles').select('full_name, company_name').eq('id', userId).single(),
        supabase
          .from('invoices')
          .select('*')
          .eq('client_id', userId)
          .order('fecha_emision', { ascending: false }),
        supabase
          .from('cash_flow_months')
          .select('*')
          .eq('client_id', userId)
          .order('mes', { ascending: true }),
        supabase.from('document_cycle').select('*').eq('client_id', userId),
      ]);

    if (invError) {
      setErrorMsg(invError.message);
    } else {
      setInvoices((invoicesData as Invoice[]) ?? []);
    }

    setCiclos((ciclosData as DocumentCycle[]) ?? []);
    setNombreSaludo(profile?.full_name ?? profile?.company_name ?? null);
    setMeses((cashData as CashFlowMonth[]) ?? []);
  }

  useEffect(() => {
    cargarDatos().finally(() => setLoading(false));
  }, [userId]);

  async function onRefresh() {
    setRefreshing(true);
    await cargarDatos();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  const pendientes = invoices.filter((inv) => estadoDe(inv) !== 'pagada');
  const totalPorCobrar = pendientes.reduce((acc, inv) => acc + inv.monto, 0);
  const vencidas = invoices.filter((inv) => estadoDe(inv) === 'vencida');
  const montoVencido = vencidas.reduce((acc, inv) => acc + inv.monto, 0);

  const proximosVencimientos = invoices
    .filter((inv) => estadoDe(inv) === 'pendiente')
    .map((inv) => ({ inv, vence: addDias(inv.fecha_emision, inv.plazo_dias) }))
    .sort((a, b) => a.vence.getTime() - b.vence.getTime())
    .slice(0, 3);

  const etapaCounts: Record<string, number> = {};
  ciclos.forEach((c) => {
    const etapa = etapaActual(c);
    etapaCounts[etapa] = (etapaCounts[etapa] ?? 0) + 1;
  });
  const etapasConDatos = Object.entries(etapaCounts);

  const ultimoMes = meses[meses.length - 1] ?? null;
  const saldoProyectado = ultimoMes ? saldoFinal(ultimoMes) : null;

  // Evolución de caja: los últimos meses cargados, para un mini gráfico de barras.
  const mesesChart = meses.slice(-6);
  const saldosChart = mesesChart.map(saldoFinal);
  const maxChart = Math.max(...saldosChart, 1);
  const minChart = Math.min(...saldosChart, 0);
  const rangoChart = Math.max(maxChart - minChart, 1);

  // Ingresos y costos del mes más reciente cargado.
  const ingresosMes = ultimoMes ? ultimoMes.cobros_esperados + ultimoMes.otros_ingresos : 0;
  const costosMes = ultimoMes ? ultimoMes.egresos_fijos + ultimoMes.egresos_variables : 0;
  const totalMes = Math.max(ingresosMes + costosMes, 1);
  const pctIngresos = (ingresosMes / totalMes) * 100;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        <View style={styles.topbar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={require('../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brand}>ARGOS INSIGHTS</Text>
          </View>
        </View>

        <Text style={styles.greet}>Hola,</Text>
        <Text style={styles.greetName}>{nombreSaludo ?? email}</Text>
        <Text style={styles.resumenTitle}>Tu resumen</Text>

        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

        <PressableScale style={styles.balanceCard} onPress={() => navigation.navigate('Caja')}>
          <Text style={styles.balanceLabel}>Saldo proyectado</Text>
          <Text style={styles.balanceValue}>
            {saldoProyectado != null ? formatCLP(saldoProyectado) : 'Sin datos todavía'}
          </Text>
        </PressableScale>

        <PressableScale style={styles.statCardWide} onPress={() => navigation.navigate('Cobros')}>
          <View style={styles.statWideRow}>
            <View>
              <Text style={styles.statLabel}>Por cobrar</Text>
              <Text style={styles.statSub}>{pendientes.length} factura{pendientes.length === 1 ? '' : 's'}</Text>
            </View>
            <Text style={styles.statValueWide} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatCLP(totalPorCobrar)}
            </Text>
          </View>
        </PressableScale>

        <PressableScale style={styles.statCardWide} onPress={() => navigation.navigate('Cobros')}>
          <View style={styles.statWideRow}>
            <View>
              <Text style={styles.statLabel}>Vencido</Text>
              <Text style={styles.statSub}>{vencidas.length} factura{vencidas.length === 1 ? '' : 's'}</Text>
            </View>
            <Text
              style={[styles.statValueWide, { color: colors.red }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCLP(montoVencido)}
            </Text>
          </View>
        </PressableScale>

        {ultimoMes && (
          <PressableScale style={[styles.statCardWide, { marginBottom: 24 }]} onPress={() => navigation.navigate('Caja')}>
            <Text style={styles.statLabel}>Ingresos y costos</Text>
            <View style={[styles.statWideRow, { marginTop: 8, marginBottom: 10 }]}>
              <View>
                <Text style={styles.statSub}>Ingresos</Text>
                <Text
                  style={[styles.statValueWide, { color: colors.greenLight }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatCLP(ingresosMes)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.statSub}>Costos</Text>
                <Text
                  style={[styles.statValueWide, { color: colors.red }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatCLP(costosMes)}
                </Text>
              </View>
            </View>
            <View style={styles.statBarTrack}>
              <View style={[styles.statBarFill, { width: `${pctIngresos}%`, backgroundColor: colors.green }]} />
            </View>
          </PressableScale>
        )}

        {mesesChart.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Evolución de caja</Text>
            <PressableScale style={styles.chartCard} onPress={() => navigation.navigate('Caja')}>
              <View style={styles.chart}>
                {mesesChart.map((mes, i) => {
                  const valor = saldosChart[i];
                  const alturaPct = Math.max(((valor - minChart) / rangoChart) * 100, 4);
                  return (
                    <View key={i} style={styles.barCol}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${alturaPct}%`, backgroundColor: valor >= 0 ? colors.green : colors.red },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{nombreMes(mes.mes)}</Text>
                    </View>
                  );
                })}
              </View>
            </PressableScale>
          </>
        )}

        <Text style={styles.sectionTitle}>Próximos vencimientos</Text>

        {proximosVencimientos.length === 0 && (
          <Text style={styles.empty}>No hay facturas pendientes por vencer.</Text>
        )}

        {proximosVencimientos.map(({ inv, vence }) => (
          <PressableScale key={inv.id} style={styles.invoiceCard} onPress={() => setSeleccionada(inv)}>
            <View>
              <Text style={styles.invoiceName}>{inv.cliente_nombre}</Text>
              <Text style={styles.invoiceMeta}>
                {inv.numero_factura ?? 'Sin número'} · vence {formatFecha(vence.toISOString().slice(0, 10))}
              </Text>
            </View>
            <Text style={styles.invoiceAmount}>{formatCLP(inv.monto)}</Text>
          </PressableScale>
        ))}

        {etapasConDatos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ciclo documental</Text>
            <PressableScale style={styles.cicloCard} onPress={() => navigation.navigate('Excel')}>
              {etapasConDatos.map(([etapa, cantidad]) => (
                <View key={etapa} style={styles.cicloRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.dot, { backgroundColor: etapaColor[etapa] ?? colors.muted2 }]} />
                    <Text style={styles.cicloLabel}>{etapa}</Text>
                  </View>
                  <Text style={styles.cicloValue}>{cantidad}</Text>
                </View>
              ))}
            </PressableScale>
          </>
        )}
      </ScrollView>

      <InvoiceDetailModal invoice={seleccionada} onClose={() => setSeleccionada(null)} />
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  logo: { width: 28, height: 26 },
  brand: { color: colors.white, fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  greet: { color: colors.muted, fontSize: 12 },
  greetName: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  resumenTitle: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 14 },
  error: { color: colors.red, fontSize: 12, marginBottom: 12 },
  empty: { color: colors.muted2, fontSize: 12, marginBottom: 10 },
  balanceCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  balanceLabel: { color: colors.muted, fontSize: 11, marginBottom: 6 },
  balanceValue: { color: colors.greenLight, fontSize: 26, fontWeight: '700' },
  statCardWide: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  statWideRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: colors.muted, fontSize: 11, marginBottom: 5 },
  statSub: { color: colors.muted2, fontSize: 10.5 },
  statValueWide: { color: colors.white, fontSize: 20, fontWeight: '700' },
  statBarTrack: { height: 4, borderRadius: 2, backgroundColor: colors.red, overflow: 'hidden' },
  statBarFill: { height: '100%', borderRadius: 2 },
  sectionTitle: { color: colors.white, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  chartCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 100 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: 14, height: '75%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel: { color: colors.muted2, fontSize: 9, marginTop: 6 },
  invoiceCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceName: { color: colors.white, fontSize: 13, fontWeight: '600', marginBottom: 3 },
  invoiceMeta: { color: colors.muted2, fontSize: 10.5 },
  invoiceAmount: { color: colors.white, fontSize: 13, fontWeight: '700' },
  cicloCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  cicloRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cicloLabel: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  cicloValue: { color: colors.muted, fontSize: 12.5, fontWeight: '700' },
  });
}
