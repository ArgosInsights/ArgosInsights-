import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../components/Text';
import InvoiceDetailModal from '../components/InvoiceDetailModal';
import { colors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { formatCLP, formatFecha, addDias, estadoDe, estadoTexto, Invoice } from '../lib/format';

const estadoColor: Record<string, string> = {
  pendiente: colors.yellow,
  pagada: colors.greenLight,
  vencida: colors.red,
};

export default function CobrosScreen({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filtro, setFiltro] = useState<'todas' | 'pendiente' | 'vencida' | 'pagada'>('todas');
  const [seleccionada, setSeleccionada] = useState<Invoice | null>(null);

  async function cargar() {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('client_id', userId)
      .order('fecha_emision', { ascending: false });
    setInvoices((data as Invoice[]) ?? []);
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

  const visibles = invoices.filter((inv) => filtro === 'todas' || estadoDe(inv) === filtro);
  const totalPorCobrar = invoices
    .filter((inv) => estadoDe(inv) !== 'pagada')
    .reduce((acc, inv) => acc + inv.monto, 0);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        <Text style={styles.title}>Cobros</Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total por cobrar</Text>
          <Text style={styles.totalValue}>{formatCLP(totalPorCobrar)}</Text>
        </View>

        <View style={styles.filtros}>
          {(['todas', 'pendiente', 'vencida', 'pagada'] as const).map((f) => (
            <Text
              key={f}
              onPress={() => setFiltro(f)}
              style={[styles.filtroChip, filtro === f && styles.filtroChipActive]}
            >
              {f === 'todas' ? 'Todas' : estadoTexto[f]}
            </Text>
          ))}
        </View>

        {visibles.length === 0 && <Text style={styles.empty}>No hay facturas en este filtro.</Text>}

        {visibles.map((inv) => {
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
  title: { color: colors.white, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  totalCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  totalLabel: { color: colors.muted, fontSize: 11, marginBottom: 6 },
  totalValue: { color: colors.greenLight, fontSize: 24, fontWeight: '700' },
  filtros: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filtroChip: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  filtroChipActive: { color: colors.bg, backgroundColor: colors.green, borderColor: colors.green },
  empty: { color: colors.muted2, fontSize: 12, marginBottom: 10 },
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
