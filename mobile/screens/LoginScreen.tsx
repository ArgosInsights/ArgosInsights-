import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../components/Text';
import { colors } from '../constants/theme';
import { supabase } from '../lib/supabase';

// Pantalla de login. Por ahora permite tanto entrar como registrarse desde acá mismo
// (para poder probar rápido). Más adelante, lo normal va a ser que las cuentas de
// cliente las cree un admin desde la web, y acá el cliente solo inicie sesión.
export default function LoginScreen() {
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [tipoEmpresa, setTipoEmpresa] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');

  async function handleSubmit() {
    setError(null);

    if (modo === 'crear' && (!nombre || !empresa || !tipoEmpresa)) {
      setError('Completá nombre, empresa y tipo de empresa.');
      return;
    }
    if (!email || !password) {
      setError('Completá email y contraseña.');
      return;
    }

    setLoading(true);
    const { error: authError } =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            // Esto viaja como "raw_user_meta_data" — el trigger que ya está en la base
            // (handle_new_user) lo toma de ahí y lo guarda en la tabla profiles.
            options: {
              data: { full_name: nombre, company_name: empresa, company_type: tipoEmpresa },
            },
          });
    setLoading(false);
    if (authError) setError(authError.message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.dot} />
        <Text style={styles.brand}>ARGOS INSIGHTS</Text>
        <Text style={styles.title}>{modo === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}</Text>

        {modo === 'crear' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              placeholderTextColor={colors.muted2}
              autoCapitalize="words"
              value={nombre}
              onChangeText={setNombre}
            />
            <TextInput
              style={styles.input}
              placeholder="Nombre de la empresa"
              placeholderTextColor={colors.muted2}
              autoCapitalize="words"
              value={empresa}
              onChangeText={setEmpresa}
            />
            <TextInput
              style={styles.input}
              placeholder="Tipo de empresa (ej: Construcción, Retail, Minería)"
              placeholderTextColor={colors.muted2}
              autoCapitalize="words"
              value={tipoEmpresa}
              onChangeText={setTipoEmpresa}
            />
          </>
        )}

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, paddingVertical: 60 },
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
