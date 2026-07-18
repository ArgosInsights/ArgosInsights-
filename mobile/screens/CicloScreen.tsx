import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { ColorPalette } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';
import { DocumentCycle, etapaActual, formatFechaOrGuion } from '../lib/format';

const ETAPAS = ['Sin iniciar', 'OC emitida', 'HES emitida', 'EDP emitido', 'Facturado', 'Pagado'] as const;

export default function CicloScreen({ userId }: { userId: string }) {
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
  const [ciclos, setCiclos] = useState<DocumentCycle[]>([]);
  const [filtro, setFiltro] = useState<'todas' | (typeof ETAPAS)[number]>('todas');

  async function cargar() {
    const { data } = await supabase
      .from('document_cycle')
      .select('*')
      .eq('client_id', userId)
      .order('fecha_oc', { ascending: false });
    setCiclos((data as DocumentCycle[]) ?? []);
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

  const visibles = ciclos.filter((c) => filtro === 'todas' || etapaActual(c) === filtro);

  const conteos: Record<string, number> = {};
  ciclos.forEach((c) => {
    const etapa = etapaActual(c);
    conteos[etapa] = (conteos[etapa] ?? 0) + 1;
  });

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        <Text style={styles.title}>Ciclo documental</Text>
        <Text style={styles.subtitle}>
          Seguimiento de cada orden de compra: OC, HES, EDP, factura y pago.
        </Text>

        <View style={styles.filtros}>
          <Text
            onPress={() => setFiltro('todas')}
            style={[styles.filtroChip, filtro === 'todas' && styles.filtroChipActive]}
          >
            Todas
          </Text>
          {ETAPAS.map((etapa) => (
            <Text
              key={etapa}
              onPress={() => setFiltro(etapa)}
              style={[styles.filtroChip, filtro === etapa && styles.filtroChipActive]}
            >
              {etapa}
              {conteos[etapa] ? ` (${conteos[etapa]})` : ''}
            </Text>
          ))}
        </View>

        {visibles.length === 0 && <Text style={styles.empty}>No hay ciclos en este filtro.</Text>}

        {visibles.map((c) => {
          const etapa = etapaActual(c);
          const pasos = [
            { label: 'OC', fecha: c.fecha_oc },
            { label: 'HES', fecha: c.fecha_hes },
            { label: 'EDP', fecha: c.fecha_edp },
            { label: 'Fact.', fecha: c.fecha_factura },
            { label: 'Pago', fecha: c.fecha_pago },
          ];
          return (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cliente} numberOfLines={1}>
                  {c.cliente_nombre}
                </Text>
                <Text style={[styles.badge, { color: etapaColor[etapa] ?? colors.muted2 }]}>{etapa}</Text>
              </View>
              <Text style={styles.oc}>{c.numero_oc ?? 'Sin N° OC'}</Text>

              <View style={styles.pasos}>
                {pasos.map((paso) => (
                  <View key={paso.label} style={styles.paso}>
                    <View style={[styles.dot, { backgroundColor: paso.fecha ? colors.greenLight : colors.line }]} />
                    <Text style={styles.pasoLabel}>{paso.label}</Text>
                    <Text style={styles.pasoFecha}>{formatFechaOrGuion(paso.fecha)}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    title: { color: colors.white, fontSize: 20, fontWeight: '700', marginBottom: 6 },
    subtitle: { color: colors.muted2, fontSize: 11.5, lineHeight: 16, marginBottom: 18 },
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
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 2 },
    cliente: { color: colors.white, fontSize: 13, fontWeight: '700', flexShrink: 1 },
    badge: { fontSize: 10.5, fontWeight: '700' },
    oc: { color: colors.muted2, fontSize: 10.5, marginBottom: 12 },
    pasos: { flexDirection: 'row', justifyContent: 'space-between' },
    paso: { alignItems: 'center', flex: 1 },
    dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
    pasoLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    pasoFecha: { color: colors.muted2, fontSize: 9 },
  });
}
