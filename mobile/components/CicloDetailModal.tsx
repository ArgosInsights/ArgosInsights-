import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { ColorPalette } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { diasEnEtapaActual, DocumentCycle, etapaActual, formatFechaOrGuion } from '../lib/format';

export default function CicloDetailModal({
  ciclo,
  onClose,
}: {
  ciclo: DocumentCycle | null;
  onClose: () => void;
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

  function Fila({ label, hecho, fecha }: { label: string; hecho: boolean; fecha: string | null }) {
    return (
      <View style={styles.fila}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.dot, { backgroundColor: hecho ? colors.greenLight : colors.line }]} />
          <Text style={styles.filaLabel}>{label}</Text>
        </View>
        <Text style={[styles.filaValor, hecho ? { color: colors.greenLight } : null]}>
          {hecho ? formatFechaOrGuion(fecha) : 'Pendiente'}
        </Text>
      </View>
    );
  }

  if (!ciclo) return null;

  const etapa = etapaActual(ciclo);
  const dias = diasEnEtapaActual(ciclo);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cliente}>{ciclo.cliente_nombre}</Text>
              <Text style={styles.oc}>{ciclo.numero_oc ?? 'Sin número de OC'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: etapaColor[etapa] + '22' }]}>
              <Text style={[styles.badgeTexto, { color: etapaColor[etapa] }]}>{etapa}</Text>
            </View>
          </View>

          {dias != null && (
            <View style={styles.diasCard}>
              <Text style={styles.diasLabel}>Lleva en esta etapa</Text>
              <Text style={styles.diasValor}>
                {dias} día{dias === 1 ? '' : 's'}
              </Text>
            </View>
          )}

          <View style={styles.detalle}>
            <Fila label="Orden de compra (OC)" hecho={!!ciclo.fecha_oc} fecha={ciclo.fecha_oc} />
            <Fila label="Hoja de entrada (HES)" hecho={!!ciclo.fecha_hes} fecha={ciclo.fecha_hes} />
            <Fila label="Estado de pago (EDP)" hecho={!!ciclo.fecha_edp} fecha={ciclo.fecha_edp} />
            <Fila label="Factura" hecho={!!ciclo.fecha_factura} fecha={ciclo.fecha_factura} />
            <Fila label="Pago" hecho={!!ciclo.fecha_pago} fecha={ciclo.fecha_pago} />
          </View>

          <Pressable style={styles.cerrar} onPress={onClose}>
            <Text style={styles.cerrarTexto}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.panel,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 22,
      paddingBottom: 36,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.line,
      alignSelf: 'center',
      marginBottom: 18,
    },
    head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18, gap: 10 },
    cliente: { color: colors.white, fontSize: 17, fontWeight: '700', marginBottom: 3 },
    oc: { color: colors.muted, fontSize: 12 },
    badge: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
    badgeTexto: { fontSize: 11, fontWeight: '700' },
    diasCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      padding: 18,
      marginBottom: 18,
    },
    diasLabel: { color: colors.muted, fontSize: 11, marginBottom: 6 },
    diasValor: { color: colors.yellow, fontSize: 26, fontWeight: '700' },
    detalle: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      paddingHorizontal: 16,
      marginBottom: 22,
    },
    fila: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    filaLabel: { color: colors.muted, fontSize: 12.5 },
    filaValor: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
    cerrar: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    cerrarTexto: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  });
}
