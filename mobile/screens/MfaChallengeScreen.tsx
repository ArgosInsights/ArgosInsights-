import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../components/Text';
import { ColorPalette } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';

// Se muestra después de un login exitoso cuando la cuenta tiene la verificación en dos
// pasos activada (ver PerfilScreen) y esta sesión todavía no pasó ese segundo paso
// (currentLevel === 'aal1' && nextLevel === 'aal2', ver App.tsx). Solo pide el código:
// no hay manera de "saltear" salvo cerrar sesión y entrar con otra cuenta.
export default function MfaChallengeScreen({ onVerificado }: { onVerificado: () => void }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verificar() {
    if (codigo.trim().length !== 6) {
      setError('Ingresá el código de 6 dígitos de tu app authenticator.');
      return;
    }
    setError(null);
    setLoading(true);
    const { data: factores } = await supabase.auth.mfa.listFactors();
    const factor = factores?.totp.find((f) => f.status === 'verified');
    if (!factor) {
      setLoading(false);
      setError('No encontramos tu método de verificación. Cerrá sesión y probá de nuevo.');
      return;
    }
    const { data: challenge, error: errChallenge } = await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });
    if (errChallenge || !challenge) {
      setLoading(false);
      setError('No pudimos verificar el código. Probá de nuevo.');
      return;
    }
    const { error: errVerify } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: codigo.trim(),
    });
    setLoading(false);
    if (errVerify) {
      setError('Código incorrecto. Revisá la hora de tu celular y probá de nuevo.');
      return;
    }
    onVerificado();
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Feather name="shield" size={22} color={colors.greenLight} />
        </View>
        <Text style={styles.title}>Verificación en dos pasos</Text>
        <Text style={styles.sub}>Ingresá el código de 6 dígitos de tu app authenticator.</Text>
        <TextInput
          style={styles.input}
          placeholder="000000"
          placeholderTextColor={colors.muted2}
          keyboardType="number-pad"
          maxLength={6}
          value={codigo}
          onChangeText={setCodigo}
          autoFocus
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.button} onPress={verificar} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Verificar</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.switchText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
    card: { width: '100%', maxWidth: 360, alignItems: 'center' },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.greenBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
    sub: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 22, textAlign: 'center' },
    input: {
      width: '100%',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 14,
      color: colors.white,
      fontSize: 18,
      letterSpacing: 6,
      textAlign: 'center',
      marginBottom: 12,
    },
    error: { color: colors.red, fontSize: 12, marginBottom: 10, alignSelf: 'flex-start' },
    button: {
      width: '100%',
      backgroundColor: colors.green,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      marginTop: 6,
      marginBottom: 18,
    },
    buttonText: { color: colors.bg, fontWeight: '700', fontSize: 14 },
    switchText: { color: colors.muted, fontSize: 12 },
  });
}
