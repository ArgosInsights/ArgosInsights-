import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../constants/theme';
import { supabase } from '../lib/supabase';

type Invoice = {
  id: string;
  cliente_nombre: string;
  numero_factura: string | null;
  monto: number;
  fecha_emision: string;
  plazo_dias: number;
  fecha_real_pago: string | null;
};

type CashFlowMonth = {
  saldo_inicial: number;
  otros_ingresos: number;
  egresos_fijos: number;
  egresos_variables: number;
};

function formatCLP(monto: number) {
  return '$' + Math.round(monto).toLocaleString('es-CL');
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function addDias(iso: string, dias: number) {
  const fecha = new Date(iso + 'T00:00:00');
  fecha.setDate(fecha.getDate() + dias);
  return fecha;
}

function estadoDe(inv: Invoice): 'pendiente' | 'pagada' | 'vencida' {
  if (inv.fecha_real_pago) return 'pagada';
  const vence = addDias(inv.fecha_emision, inv.plazo_dias);
  return vence < new Date() ? 'vencida' : 'pendiente';
}

const estadoColor: Record<string, string> = {
  pendiente: colors.yellow,
  pagada: colors.greenLight,
  vencida: colors.red,
};

const estadoTexto: Record<string, string> = {
  pendiente: 'Pendiente',
  pagada: 'Pagada',
  vencida: 'Vencida',
};

export default function HomeScreen({ userId, email }: { userId: string; email: string }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [saldoProyectado, setSaldoProyectado] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function cargarDatos() {
    setErrorMsg(null);

    const [{ data: profile }, { data: invoicesData, error: invError }, { data: cashData }] =
      await Promise.all([
        supabase.from('profiles').select('company_name').eq('id', userId).single(),
        supabase
          .from('invoices')
          .select('*')
          .eq('client_id', userId)
          .order('fecha_emision', { ascending: false }),
        supabase
          .from('cash_flow_months')
          .select('saldo_inicial, otros_ingresos, egresos_fijos, egresos_variables')
          .eq('client_id', userId)
          .order('mes', { ascending: false })
          .limit(1),
      ]);

    if (invError) {
      setErrorMsg(invError.message);
    } else {
      setInvoices((invoicesData as Invoice[]) ?? []);
    }

    setCompanyName(profile?.company_name ?? null);

    const ultimoMes = (cashData as CashFlowMonth[] | null)?.[0];
    if (ultimoMes) {
      setSaldoProyectado(
        ultimoMes.saldo_inicial + ultimoMes.otros_ingresos - ultimoMes.egresos_fijos - ultimoMes.egresos_variables
      );
    }
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
            <View style={styles.dot} />
            <Text style={styles.brand}>ARGOS INSIGHTS</Text>
          </View>
          <TouchableOpacity onPress={() => supabase.auth.signOut()}>
            <Text style={styles.logout}>Salir</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.greet}>Hola,</Text>
        <Text style={styles.greetName}>{companyName ?? email}</Text>

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
            <View key={inv.id} style={styles.invoiceCard}>
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
            </View>
          );
        })}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.green },
  brand: { color: colors.white, fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  logout: { color: colors.muted, fontSize: 12 },
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
