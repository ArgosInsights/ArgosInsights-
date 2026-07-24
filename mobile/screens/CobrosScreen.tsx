import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../components/Text';
import InvoiceDetailModal from '../components/InvoiceDetailModal';
import { ColorPalette } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  addDias,
  estadoDe,
  estadoTexto,
  formatCLP,
  formatFecha,
  Invoice,
  PaymentPrediction,
  riesgoTexto,
} from '../lib/format';

export default function CobrosScreen({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const estadoColor: Record<string, string> = {
    pendiente: colors.yellow,
    pagada: colors.greenLight,
    vencida: colors.red,
  };
  const riesgoColor: Record<string, string> = {
    bajo: colors.greenLight,
    medio: colors.yellow,
    alto: colors.red,
  };
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [predicciones, setPredicciones] = useState<Record<string, PaymentPrediction>>({});
  const [filtro, setFiltro] = useState<'todas' | 'pendiente' | 'vencida' | 'pagada'>('todas');
  const [seleccionada, setSeleccionada] = useState<Invoice | null>(null);

  async function cargar() {
    const [{ data }, { data: predsData }] = await Promise.all([
      supabase
        .from('invoices')
        .select('*')
        .eq('client_id', userId)
        .order('fecha_emision', { ascending: false }),
      supabase.from('payment_predictions_latest').select('*').eq('client_id', userId),
    ]);
    setInvoices((data as Invoice[]) ?? []);
    const porFactura: Record<string, PaymentPrediction> = {};
    ((predsData as PaymentPrediction[]) ?? []).forEach((p) => {
      porFactura[p.invoice_id] = p;
    });
    setPredicciones(porFactura);
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
          const pred = estado !== 'pagada' ? predicciones[inv.id] : undefined;
          return (
            <TouchableOpacity
              key={inv.id}
              style={styles.invoiceCard}
              activeOpacity={0.7}
              onPress={() => setSeleccionada(inv)}
            >
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.invoiceName}>{inv.cliente_nombre}</Text>
                <Text style={styles.invoiceMeta}>
                  {inv.numero_factura ?? 'Sin número'} · vence {formatFecha(vence.toISOString().slice(0, 10))}
                </Text>
                {pred && (
                  <Text style={styles.invoicePred}>
                    Cobro estimado: {formatFecha(pred.predicted_payment_date)}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.invoiceAmount}>{formatCLP(inv.monto)}</Text>
                <Text style={[styles.badge, { color: estadoColor[estado] }]}>{estadoTexto[estado]}</Text>
                {pred && (
                  <Text style={[styles.badge, { color: riesgoColor[pred.risk_level] }]}>
                    {riesgoTexto[pred.risk_level]}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <InvoiceDetailModal
        invoice={seleccionada}
        prediction={seleccionada ? predicciones[seleccionada.id] ?? null : null}
        onClose={() => setSeleccionada(null)}
      />
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
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
  invoicePred: { color: colors.muted, fontSize: 10.5, marginTop: 3 },
  invoiceAmount: { color: colors.white, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  badge: { fontSize: 10.5, fontWeight: '700', marginBottom: 2 },
  });
}
