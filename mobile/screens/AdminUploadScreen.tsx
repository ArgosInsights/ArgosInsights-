import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { parseArgosExcel } from '../lib/excelParser';

type ClientOption = { id: string; label: string };

export default function AdminUploadScreen() {
  const [clientes, setClientes] = useState<ClientOption[]>([]);
  const [clienteId, setClienteId] = useState<string>('');
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [estado, setEstado] = useState<'idle' | 'procesando' | 'ok' | 'error'>('idle');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [resumen, setResumen] = useState<{ facturas: number; meses: number; ciclos: number } | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, company_name')
      .then(({ data }) => {
        const opciones = (data ?? []).map((p) => ({
          id: p.id as string,
          label: (p.company_name as string) || (p.full_name as string) || p.id,
        }));
        setClientes(opciones);
        if (opciones[0]) setClienteId(opciones[0].id);
      });
  }, []);

  async function elegirArchivo() {
    // Usamos "*/*" en vez de filtrar por tipo Excel: con Google Drive y otros proveedores
    // el tipo de archivo reportado a veces no coincide exacto y iOS deja el archivo
    // "grisado" sin poder tocarlo. Validamos la extensión nosotros mismos abajo.
    const resultado = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (resultado.canceled || !resultado.assets?.[0]) return;
    const archivo = resultado.assets[0];

    const nombreMin = archivo.name.toLowerCase();
    if (!nombreMin.endsWith('.xlsx') && !nombreMin.endsWith('.xls')) {
      setEstado('error');
      setMensaje(`"${archivo.name}" no parece un Excel (.xlsx). Elegí el archivo correcto.`);
      return;
    }

    setArchivoNombre(archivo.name);
    setEstado('idle');
    setMensaje(null);
    setResumen(null);

    await procesarArchivo(archivo.uri);
  }

  async function procesarArchivo(uri: string) {
    if (!clienteId) {
      setEstado('error');
      setMensaje('Elegí primero para qué cliente es este archivo.');
      return;
    }

    setEstado('procesando');
    setMensaje(null);

    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { invoices, cashFlow, documentCycle } = parseArgosExcel(base64);

      // Reemplaza los datos anteriores del cliente por los nuevos del Excel
      // (borra y vuelve a insertar, así una re-carga siempre refleja el archivo actual).
      await Promise.all([
        supabase.from('invoices').delete().eq('client_id', clienteId),
        supabase.from('cash_flow_months').delete().eq('client_id', clienteId),
        supabase.from('document_cycle').delete().eq('client_id', clienteId),
      ]);

      const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
        invoices.length
          ? supabase.from('invoices').insert(invoices.map((f) => ({ ...f, client_id: clienteId })))
          : Promise.resolve({ error: null }),
        cashFlow.length
          ? supabase.from('cash_flow_months').insert(cashFlow.map((f) => ({ ...f, client_id: clienteId })))
          : Promise.resolve({ error: null }),
        documentCycle.length
          ? supabase.from('document_cycle').insert(documentCycle.map((f) => ({ ...f, client_id: clienteId })))
          : Promise.resolve({ error: null }),
      ]);

      const error = e1 || e2 || e3;
      if (error) throw error;

      setEstado('ok');
      setResumen({ facturas: invoices.length, meses: cashFlow.length, ciclos: documentCycle.length });
    } catch (err: any) {
      setEstado('error');
      setMensaje(err?.message ?? 'No se pudo procesar el archivo.');
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Cargar Excel</Text>
        <Text style={styles.subtitle}>
          Subí la plantilla de Orden Financiero de un cliente. Reemplaza todos sus datos anteriores por los del
          archivo.
        </Text>

        <Text style={styles.label}>Cliente</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={clienteId}
            onValueChange={setClienteId}
            style={{ color: colors.white }}
            dropdownIconColor={colors.white}
          >
            {clientes.map((c) => (
              <Picker.Item key={c.id} label={c.label} value={c.id} color={colors.white} />
            ))}
          </Picker>
        </View>

        <TouchableOpacity style={styles.button} onPress={elegirArchivo} disabled={estado === 'procesando'}>
          <Text style={styles.buttonText}>
            {archivoNombre ? 'Elegir otro archivo' : 'Elegir archivo Excel (.xlsx)'}
          </Text>
        </TouchableOpacity>

        {archivoNombre && <Text style={styles.archivo}>{archivoNombre}</Text>}

        {estado === 'procesando' && (
          <View style={styles.estadoBox}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.estadoTexto}>Procesando...</Text>
          </View>
        )}

        {estado === 'ok' && resumen && (
          <View style={[styles.estadoBox, { borderColor: colors.green }]}>
            <Text style={[styles.estadoTexto, { color: colors.greenLight }]}>
              Listo. Se cargaron {resumen.facturas} facturas, {resumen.meses} meses de flujo de caja y{' '}
              {resumen.ciclos} ciclos documentales.
            </Text>
          </View>
        )}

        {estado === 'error' && mensaje && (
          <View style={[styles.estadoBox, { borderColor: colors.red }]}>
            <Text style={[styles.estadoTexto, { color: colors.red }]}>{mensaje}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { color: colors.white, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: colors.muted2, fontSize: 11.5, lineHeight: 16, marginBottom: 20 },
  label: { color: colors.muted, fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerWrap: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    marginBottom: 18,
    overflow: 'hidden',
  },
  button: {
    backgroundColor: colors.green,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.bg, fontWeight: '700', fontSize: 13 },
  archivo: { color: colors.muted, fontSize: 12, marginTop: 10, textAlign: 'center' },
  estadoBox: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  estadoTexto: { color: colors.white, fontSize: 12, flex: 1, lineHeight: 17 },
});
