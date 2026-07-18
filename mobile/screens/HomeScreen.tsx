import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../components/Text';
import InvoiceDetailModal from '../components/InvoiceDetailModal';
import { colors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import {
  addDias,
  CashFlowMonth,
  estadoDe,
  estadoTexto,
  formatCLP,
  formatFecha,
  Invoice,
  saldoFinal,
} from '../lib/format';

const estadoColor: Record<string, string> = {
  pendiente: colors.yellow,
  pagada: colors.greenLight,
  vencida: colors.red,
};

export default function HomeScreen({ userId, email }: { userId: string; email: string }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nombreSaludo, setNombreSaludo] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [saldoProyectado, setSaldoProyectado] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [seleccionada, setSeleccionada] = useState<Invoice | null>(null);

  async function cargarDatos() {
    setErrorMsg(null);

    const [{ data: profile }, { data: invoicesData, error: invError }, { data: cashData }] =
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
      ]);

    if (invError) {
      setErrorMsg(invError.message);
    } else {
      setInvoices((invoicesData as Invoice[]) ?? []);
    }

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

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >

        <View style={styles.topbar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={require('../assets/icon.png')} style={styles.logo} />
            <Text style={styles.brand}>ARGOS INSIGHTS</Text>
          </View>
        </View>

        <Text style={styles.greet}>Hola,</Text>
        <Text style={styles.greetName}>{nombreSaludo ?? email}</Text>

        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo proyectado</Text>
          <Text style={styles.balanceValue}>
            {saldoProyectado != null ? formatCLP(saldoProyectado) : 'Sin datos todavía'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Cuentas por cobrar</Text>

        {invoices.length === 0 && (
          <Text style={styles.empty}>Todavía no hay facturas cargadas.</Text>
        )}

        {invoices.map((inv) => {
          const estado = estadoDe(inv);
          const vence = addDias(inv.fecha_emision, inv.plazo_dias);
          return (
            <TouchableOpacity
              key={inv.id}
              style={styles.invoiceCard}
              activeOpacity={0.7}
              onPress={() => setSeleccionada(inv)}
            >
              <View>
                <Text style={styles.invoiceName}>{inv.cliente_nombre}</Text>
                <Text style={styles.invoiceMeta}>
                  {inv.numero_factura ?? 'Sin número'} · vence {formatFecha(vence.toISOString().slice(0, 10))}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.invoiceAmount}>{formatCLP(inv.monto)}</Text>
                <Text style={[styles.badge, { color: estadoColor[estado] }]}>{estadoTexto[estado]}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

      </ScrollView>

      <InvoiceDetailModal invoice={seleccionada} onClose={() => setSeleccionada(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  logo: { width: 24, height: 24, borderRadius: 12 },
  brand: { color: colors.white, fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  greet: { color: colors.muted, fontSize: 12 },
  greetName: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 18 },
  error: { color: colors.red, fontSize: 12, marginBottom: 12 },
  empty: { color: colors.muted2, fontSize: 12, marginBottom: 10 },
  balanceCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },
  balanceLabel: { color: colors.muted, fontSize: 11, marginBottom: 6 },
  balanceValue: { color: colors.greenLight, fontSize: 26, fontWeight: '700' },
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
  invoiceAmount: { color: colors.white, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  badge: { fontSize: 10.5, fontWeight: '700' },
});
