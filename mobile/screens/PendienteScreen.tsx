import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../components/Text';
import { ColorPalette } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';

// Se muestra cuando el usuario ya inició sesión pero su cuenta todavía no fue aprobada
// por un admin (profiles.aprobado = false). No tiene acceso a ninguna pestaña hasta que
// lo aprueben — solo puede reintentar (por si ya lo aprobaron y no se refrescó) o cerrar
// sesión.
export default function PendienteScreen({ onReintentar }: { onReintentar: () => Promise<void> }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [verificando, setVerificando] = useState(false);

  async function reintentar() {
    setVerificando(true);
    await onReintentar();
    setVerificando(false);
  }

  return (
    <View style={styles.root}>
      <Image source={require('../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
      <View style={styles.iconWrap}>
        <Feather name="clock" size={28} color={colors.yellow} />
      </View>
      <Text style={styles.title}>Cuenta en revisión</Text>
      <Text style={styles.texto}>
        Ya creamos tu cuenta. Un administrador de Argos Insights tiene que aprobarla antes de que puedas ver tus
        datos — te vamos a avisar en cuanto esté lista.
      </Text>

      <TouchableOpacity style={styles.button} onPress={reintentar} disabled={verificando}>
        {verificando ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.buttonText}>Ya me aprobaron, revisar de nuevo</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logout}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
    logo: { width: 56, height: 52, marginBottom: 24 },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    title: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 10 },
    texto: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 28 },
    button: {
      width: '100%',
      backgroundColor: colors.green,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      marginBottom: 18,
    },
    buttonText: { color: colors.bg, fontWeight: '700', fontSize: 14 },
    logout: { color: colors.red, fontSize: 12.5, fontWeight: '600' },
  });
}
