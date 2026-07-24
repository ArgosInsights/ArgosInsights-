import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../components/Text';
import { ColorPalette } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';
import { formatFechaHora } from '../lib/format';

// Pantalla solo para admin (MainTabs la agrega como pestaña nomás si profiles.role === 'admin').
// Reemplaza el flujo de aprobar cuentas a mano desde el Table Editor de Supabase: acá se ve
// quién se registró, sus datos, y se aprueba o se revoca acceso con un toque.
//
// Nota: no se muestra el email del cliente porque vive en auth.users, no en profiles, y esa
// tabla no está expuesta por la API — solo tenemos lo que el cliente cargó al registrarse
// (nombre, empresa, tipo de empresa).

type ClientProfile = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  company_type: string | null;
  aprobado: boolean;
  created_at: string;
};

type Filtro = 'pendientes' | 'aprobados' | 'todos';

export default function AdminScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientes, setClientes] = useState<ClientProfile[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('pendientes');
  const [procesando, setProcesando] = useState<string | null>(null);

  async function cargar() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, company_type, aprobado, created_at')
      .eq('role', 'client')
      .order('aprobado', { ascending: true })
      .order('created_at', { ascending: false });
    setClientes((data as ClientProfile[]) ?? []);
  }

  useEffect(() => {
    cargar().finally(() => setLoading(false));
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }

  async function setAprobado(id: string, aprobado: boolean) {
    setProcesando(id);
    const { error } = await supabase.from('profiles').update({ aprobado }).eq('id', id);
    setProcesando(null);
    if (error) {
      Alert.alert('No se pudo actualizar', error.message);
      return;
    }
    // Actualización optimista en vez de recargar todo — se siente más rápido.
    setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, aprobado } : c)));
  }

  function confirmarRevocar(c: ClientProfile) {
    Alert.alert(
      'Revocar acceso',
      `${c.full_name ?? 'Este cliente'} va a dejar de poder ver sus datos hasta que lo apruebes de nuevo. ¿Confirmás?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Revocar', style: 'destructive', onPress: () => setAprobado(c.id, false) },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  const pendientes = clientes.filter((c) => !c.aprobado);
  const aprobados = clientes.filter((c) => c.aprobado);
  const visibles = filtro === 'pendientes' ? pendientes : filtro === 'aprobados' ? aprobados : clientes;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        <Text style={styles.title}>Admin</Text>
        <Text style={styles.subtitle}>Aprobá cuentas nuevas o revocá acceso a un cliente.</Text>

        <View style={styles.filtros}>
          <Text
            onPress={() => setFiltro('pendientes')}
            style={[styles.filtroChip, filtro === 'pendientes' && styles.filtroChipActive]}
          >
            Pendientes{pendientes.length ? ` (${pendientes.length})` : ''}
          </Text>
          <Text
            onPress={() => setFiltro('aprobados')}
            style={[styles.filtroChip, filtro === 'aprobados' && styles.filtroChipActive]}
          >
            Aprobados{aprobados.length ? ` (${aprobados.length})` : ''}
          </Text>
          <Text onPress={() => setFiltro('todos')} style={[styles.filtroChip, filtro === 'todos' && styles.filtroChipActive]}>
            Todos
          </Text>
        </View>

        {visibles.length === 0 && (
          <Text style={styles.empty}>
            {filtro === 'pendientes' ? 'No hay cuentas esperando aprobación.' : 'No hay clientes en este filtro.'}
          </Text>
        )}

        {visibles.map((c) => (
          <View key={c.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.nombre} numberOfLines={1}>
                {c.full_name ?? 'Sin nombre'}
              </Text>
              <Text style={[styles.badge, c.aprobado ? styles.badgeAprobado : styles.badgePendiente]}>
                {c.aprobado ? 'Aprobado' : 'Pendiente'}
              </Text>
            </View>

            <Text style={styles.empresa} numberOfLines={1}>
              {c.company_name ?? 'Sin empresa'}
              {c.company_type ? ` · ${c.company_type}` : ''}
            </Text>
            <Text style={styles.fecha}>Se registró el {formatFechaHora(c.created_at)}</Text>

            {procesando === c.id ? (
              <ActivityIndicator color={colors.green} style={{ marginTop: 12 }} />
            ) : c.aprobado ? (
              <TouchableOpacity style={styles.botonRevocar} onPress={() => confirmarRevocar(c)}>
                <Feather name="user-x" size={13} color={colors.red} />
                <Text style={styles.botonRevocarTexto}>Revocar acceso</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.botonAprobar} onPress={() => setAprobado(c.id, true)}>
                <Feather name="check" size={13} color={colors.bg} />
                <Text style={styles.botonAprobarTexto}>Aprobar cuenta</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
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
    nombre: { color: colors.white, fontSize: 13, fontWeight: '700', flexShrink: 1 },
    badge: {
      fontSize: 10,
      fontWeight: '700',
      borderRadius: 20,
      paddingVertical: 3,
      paddingHorizontal: 9,
      overflow: 'hidden',
    },
    badgePendiente: { color: colors.yellow, backgroundColor: colors.yellowBg },
    badgeAprobado: { color: colors.greenLight, backgroundColor: colors.greenBg },
    empresa: { color: colors.muted, fontSize: 11.5, marginTop: 4 },
    fecha: { color: colors.muted2, fontSize: 10.5, marginTop: 4 },
    botonAprobar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.green,
      borderRadius: 10,
      paddingVertical: 9,
      marginTop: 12,
    },
    botonAprobarTexto: { color: colors.bg, fontSize: 12, fontWeight: '700' },
    botonRevocar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.red,
      borderRadius: 10,
      paddingVertical: 9,
      marginTop: 12,
    },
    botonRevocarTexto: { color: colors.red, fontSize: 12, fontWeight: '700' },
  });
}
