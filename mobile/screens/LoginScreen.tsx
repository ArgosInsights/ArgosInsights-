import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false);
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
    if (modo === 'crear' && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
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
        <Image source={require('../assets/icon.png')} style={styles.logo} />
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

        <View style={styles.passwordWrap}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Contraseña"
            placeholderTextColor={colors.muted2}
            secureTextEntry={!mostrarPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setMostrarPassword((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name={mostrarPassword ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {modo === 'crear' && (
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirmar contraseña"
              placeholderTextColor={colors.muted2}
              secureTextEntry={!mostrarConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setMostrarConfirmPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name={mostrarConfirmPassword ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.buttonText}>{modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setModo(modo === 'entrar' ? 'crear' : 'entrar');
            setError(null);
            setConfirmPassword('');
          }}
        >
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
  logo: { width: 56, height: 56, borderRadius: 14, marginBottom: 14 },
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
  passwordWrap: {
    width: '100%',
    marginBottom: 12,
    justifyContent: 'center',
  },
  passwordInput: {
    width: '100%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    paddingRight: 44,
    color: colors.white,
    fontSize: 14,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
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
