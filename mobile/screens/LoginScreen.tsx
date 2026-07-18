import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../constants/theme';
import { supabase } from '../lib/supabase';

// Pantalla de login. Por ahora permite tanto entrar como registrarse desde acá mismo
// (para poder probar rápido). Más adelante, lo normal va a ser que las cuentas de
// cliente las cree un admin desde la web, y acá el cliente solo inicie sesión.
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');

  async function handleSubmit() {
    setError(null);
    if (!email || !password) {
      setError('Completá email y contraseña.');
      return;
    }
    setLoading(true);
    const { error: authError } =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (authError) setError(authError.message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.dot} />
      <Text style={styles.brand}>ARGOS INSIGHTS</Text>
      <Text style={styles.title}>{modo === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.muted2}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={colors.muted2}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.buttonText}>{modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setModo(modo === 'entrar' ? 'crear' : 'entrar')}>
        <Text style={styles.switchText}>
          {modo === 'entrar' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entrar'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.green, marginBottom: 10 },
  brand: { color: colors.white, fontWeight: '700', fontSize: 14, letterSpacing: 1, marginBottom: 30 },
  title: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 20, alignSelf: 'flex-start' },
  input: {
    width: '100%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    color: colors.white,
    marginBottom: 12,
    fontSize: 14,
  },
  error: { color: colors.red, fontSize: 12, marginBottom: 10, alignSelf: 'flex-start' },
  button: {
    width: '100%',
    backgroundColor: colors.green,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: { color: colors.bg, fontWeight: '700', fontSize: 14 },
  switchText: { color: colors.greenLight, fontSize: 12, marginTop: 18 },
});
