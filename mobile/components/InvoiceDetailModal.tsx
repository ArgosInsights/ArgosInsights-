import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { ColorPalette } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import {
  addDias,
  confianzaTexto,
  diasAtraso,
  estadoDe,
  estadoTexto,
  formatCLP,
  formatFecha,
  Invoice,
  PaymentPrediction,
  riesgoTexto,
} from '../lib/format';

export default function InvoiceDetailModal({
  invoice,
  prediction,
  onClose,
}: {
  invoice: Invoice | null;
  prediction?: PaymentPrediction | null;
  onClose: () => void;
}) {
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

  function Fila({ label, valor, color }: { label: string; valor: string; color?: string }) {
    return (
      <View style={styles.fila}>
        <Text style={styles.filaLabel}>{label}</Text>
        <Text style={[styles.filaValor, color ? { color } : null]}>{valor}</Text>
      </View>
    );
  }

  if (!invoice) return null;

  const estado = estadoDe(invoice);
  const vence = addDias(invoice.fecha_emision, invoice.plazo_dias);
  const atraso = diasAtraso(invoice);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cliente}>{invoice.cliente_nombre}</Text>
              <Text style={styles.factura}>{invoice.numero_factura ?? 'Sin número de factura'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: estadoColor[estado] + '22' }]}>
              <Text style={[styles.badgeTexto, { color: estadoColor[estado] }]}>{estadoTexto[estado]}</Text>
            </View>
          </View>

          <View style={styles.montoCard}>
            <Text style={styles.montoLabel}>Monto</Text>
            <Text style={styles.monto}>{formatCLP(invoice.monto)}</Text>
          </View>

          <View style={styles.detalle}>
            <Fila label="Fecha de emisión" valor={formatFecha(invoice.fecha_emision)} />
            <Fila label="Plazo" valor={`${invoice.plazo_dias} días`} />
            <Fila label="Fecha de vencimiento" valor={formatFecha(vence.toISOString().slice(0, 10))} />
            {invoice.fecha_real_pago && (
              <Fila
                label="Fecha de pago"
                valor={formatFecha(invoice.fecha_real_pago)}
                color={colors.greenLight}
              />
            )}
            {estado === 'vencida' && (
              <Fila label="Días de atraso" valor={`${atraso} días`} color={colors.red} />
            )}
          </View>

          {prediction && estado !== 'pagada' && (
            <View style={styles.prediccion}>
              <View style={styles.prediccionHead}>
                <Text style={styles.prediccionTitulo}>Predicción de cobro</Text>
                <View style={[styles.badge, { backgroundColor: riesgoColor[prediction.risk_level] + '22' }]}>
                  <Text style={[styles.badgeTexto, { color: riesgoColor[prediction.risk_level] }]}>
                    {riesgoTexto[prediction.risk_level]} · {prediction.risk_score}
                  </Text>
                </View>
              </View>
              <Fila
                label="Fecha estimada de pago"
                valor={formatFecha(prediction.predicted_payment_date)}
                color={colors.greenLight}
              />
              <Text style={styles.prediccionExplicacion}>{prediction.explanation}</Text>
              <Text style={styles.prediccionMeta}>
                Estimación con {confianzaTexto[prediction.confidence]}, según el comportamiento real de pago.
              </Text>
            </View>
          )}

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
    head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
    cliente: { color: colors.white, fontSize: 17, fontWeight: '700', marginBottom: 3 },
    factura: { color: colors.muted, fontSize: 12 },
    badge: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
    badgeTexto: { fontSize: 11, fontWeight: '700' },
    montoCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      padding: 18,
      marginBottom: 18,
    },
    montoLabel: { color: colors.muted, fontSize: 11, marginBottom: 6 },
    monto: { color: colors.greenLight, fontSize: 26, fontWeight: '700' },
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
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    filaLabel: { color: colors.muted, fontSize: 12.5 },
    filaValor: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
    prediccion: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingBottom: 14,
      marginBottom: 22,
    },
    prediccionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 14,
      marginBottom: 2,
    },
    prediccionTitulo: { color: colors.white, fontSize: 13, fontWeight: '700' },
    prediccionExplicacion: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 10 },
    prediccionMeta: { color: colors.muted2, fontSize: 10.5, marginTop: 8 },
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
