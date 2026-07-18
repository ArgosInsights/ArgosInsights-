import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../components/Text';
import { ColorPalette } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';

type Profile = {
  full_name: string | null;
  company_name: string | null;
  company_type: string | null;
  role: string;
};

export default function PerfilScreen({ userId, email }: { userId: string; email: string }) {
  const { colors, modo, toggleModo } = useTheme();
  const styles = getStyles(colors);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name, company_name, company_type, role')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        setProfile(data as Profile);
        setLoading(false);
      });
  }, [userId]);

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Perfil</Text>

        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {(profile?.full_name ?? email).charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.nombre}>{profile?.full_name ?? 'Sin nombre'}</Text>
          {profile?.company_name && <Text style={styles.empresa}>{profile.company_name}</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Empresa</Text>
            <Text style={styles.value}>{profile?.company_name ?? '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tipo de empresa</Text>
            <Text style={styles.value}>{profile?.company_type ?? '—'}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Rol</Text>
            <Text style={styles.value}>{profile?.role === 'admin' ? 'Administrador' : 'Cliente'}</Text>
          </View>
        </View>

        <View style={[styles.card, styles.temaRow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Feather name={modo === 'dia' ? 'sun' : 'moon'} size={16} color={colors.greenLight} />
            <View>
              <Text style={styles.temaLabel}>Modo {modo === 'dia' ? 'día' : 'noche'}</Text>
              <Text style={styles.temaSub}>{modo === 'dia' ? 'Pantalla clara' : 'Pantalla oscura'}</Text>
            </View>
          </View>
          <Switch
            value={modo === 'dia'}
            onValueChange={toggleModo}
            trackColor={{ false: colors.line, true: colors.green }}
            thumbColor="#ffffff"
          />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    title: { color: colors.white, fontSize: 20, fontWeight: '700', marginBottom: 24 },
    avatarWrap: { alignItems: 'center', marginBottom: 24 },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.greenBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    avatarInitial: { color: colors.greenLight, fontSize: 24, fontWeight: '700' },
    nombre: { color: colors.white, fontSize: 16, fontWeight: '700' },
    empresa: { color: colors.muted, fontSize: 12, marginTop: 2 },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    label: { color: colors.muted, fontSize: 12 },
    value: { color: colors.white, fontSize: 12, fontWeight: '600' },
    temaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    temaLabel: { color: colors.white, fontSize: 13, fontWeight: '700' },
    temaSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
    logoutButton: {
      borderWidth: 1,
      borderColor: colors.red,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    logoutText: { color: colors.red, fontWeight: '700', fontSize: 13 },
  });
}
