import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { ColorPalette } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';
import { CashFlowMonth, formatCLP, nombreMes, saldoFinal } from '../lib/format';

export default function CajaScreen({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [meses, setMeses] = useState<CashFlowMonth[]>([]);

  async function cargar() {
    const { data } = await supabase
      .from('cash_flow_months')
      .select('*')
      .eq('client_id', userId)
      .order('mes', { ascending: true });
    setMeses((data as CashFlowMonth[]) ?? []);
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

  const saldos = meses.map(saldoFinal);
  const maximo = Math.max(...saldos, 1);
  const minimo = Math.min(...saldos, 0);
  const rango = Math.max(maximo - minimo, 1);
  const ultimo = saldos[saldos.length - 1] ?? null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        <Text style={styles.title}>Caja</Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Saldo proyectado (último mes cargado)</Text>
          <Text style={styles.totalValue}>{ultimo != null ? formatCLP(ultimo) : 'Sin datos'}</Text>
        </View>

        {meses.length === 0 ? (
          <Text style={styles.empty}>Todavía no hay flujo de caja cargado.</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Evolución</Text>
            <View style={styles.chart}>
              {meses.map((mes, i) => {
                const valor = saldos[i];
                const alturaPct = Math.max(((valor - minimo) / rango) * 100, 4);
                return (
                  <View key={i} style={styles.barCol}>
                    <Text style={styles.barValor}>{(valor / 1000000).toFixed(1)}M</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${alturaPct}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>{nombreMes(mes.mes)}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Detalle por mes</Text>
            {meses.map((mes, i) => (
              <View key={i} style={styles.mesCard}>
                <Text style={styles.mesNombre}>{nombreMes(mes.mes)}</Text>
                <View style={styles.mesRow}>
                  <Text style={styles.mesLabel}>Saldo inicial</Text>
                  <Text style={styles.mesValor}>{formatCLP(mes.saldo_inicial)}</Text>
                </View>
                <View style={styles.mesRow}>
                  <Text style={styles.mesLabel}>Cobros esperados</Text>
                  <Text style={[styles.mesValor, { color: colors.greenLight }]}>
                    +{formatCLP(mes.cobros_esperados)}
                  </Text>
                </View>
                <View style={styles.mesRow}>
                  <Text style={styles.mesLabel}>Otros ingresos</Text>
                  <Text style={[styles.mesValor, { color: colors.greenLight }]}>
                    +{formatCLP(mes.otros_ingresos)}
                  </Text>
                </View>
                <View style={styles.mesRow}>
                  <Text style={styles.mesLabel}>Egresos</Text>
                  <Text style={[styles.mesValor, { color: colors.red }]}>
                    -{formatCLP(mes.egresos_fijos + mes.egresos_variables)}
                  </Text>
                </View>
                <View style={[styles.mesRow, { marginTop: 4 }]}>
                  <Text style={[styles.mesLabel, { fontWeight: '700', color: colors.white }]}>Saldo final</Text>
                  <Text style={[styles.mesValor, { fontWeight: '700', color: colors.greenLight }]}>
                    {formatCLP(saldoFinal(mes))}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
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
    marginBottom: 20,
  },
  totalLabel: { color: colors.muted, fontSize: 11, marginBottom: 6 },
  totalValue: { color: colors.greenLight, fontSize: 24, fontWeight: '700' },
  empty: { color: colors.muted2, fontSize: 12 },
  sectionTitle: { color: colors.white, fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 6 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 170,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValor: { color: colors.muted2, fontSize: 8.5, marginBottom: 4 },
  barTrack: { width: 14, height: '70%', justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: colors.green, borderRadius: 4, minHeight: 4 },
  barLabel: { color: colors.muted2, fontSize: 9, marginTop: 6 },
  mesCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  mesNombre: { color: colors.white, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  mesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  mesLabel: { color: colors.muted, fontSize: 11.5 },
  mesValor: { color: colors.white, fontSize: 11.5, fontWeight: '600' },
  });
}
