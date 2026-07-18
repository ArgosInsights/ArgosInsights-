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
  const [saldoProyectado, setSaldoProyectado] = useState<number | null>(null);
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
          .order('mes', { ascending: false })
          .limit(1),
        supabase.from('document_cycle').select('*').eq('client_id', userId),
      ]);

    if (invError) {
      setErrorMsg(invError.message);
    } else {
      setInvoices((invoicesData as Invoice[]) ?? []);
    }

    setCiclos((ciclosData as DocumentCycle[]) ?? []);
    setNombreSaludo(profile?.full_name ?? profile?.company_name ?? null);

    const ultimoMes = (cashData as CashFlowMonth[] | null)?.[0];
    setSaldoProyectado(ultimoMes ? saldoFinal(ultimoMes) : null);
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

        <View style={styles.statsRow}>
          <PressableScale style={styles.statCard} onPress={() => navigation.navigate('Cobros')}>
            <Text style={styles.statLabel}>Por cobrar</Text>
            <Text style={styles.statValue}>{formatCLP(totalPorCobrar)}</Text>
            <Text style={styles.statSub}>{pendientes.length} factura{pendientes.length === 1 ? '' : 's'}</Text>
          </PressableScale>
          <PressableScale style={styles.statCard} onPress={() => navigation.navigate('Cobros')}>
            <Text style={styles.statLabel}>Vencido</Text>
            <Text style={[styles.statValue, { color: colors.red }]}>{formatCLP(montoVencido)}</Text>
            <Text style={styles.statSub}>{vencidas.length} factura{vencidas.length === 1 ? '' : 's'}</Text>
          </PressableScale>
        </View>

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
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
  },
  statLabel: { color: colors.muted, fontSize: 10.5, marginBottom: 6 },
  statValue: { color: colors.white, fontSize: 16, fontWeight: '700', marginBottom: 3 },
  statSub: { color: colors.muted2, fontSize: 10 },
  sectionTitle: { color: colors.white, fontSize: 14, fontWeight: '700', marginBottom: 10 },
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
