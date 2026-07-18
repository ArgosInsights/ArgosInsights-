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
import { ColorPalette } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';

// Pantalla de login. Las cuentas de cliente las crea un admin invitándolas desde el
// panel de Supabase (Authentication > Users > Invite), con el nombre/empresa/tipo de
// empresa como metadata — el trigger handle_new_user ya toma esos datos y arma la fila
// en "profiles" sola. Acá el cliente solo inicia sesión (o recupera su contraseña); no
// hay auto-registro para no tener cuentas sueltas sin asociar a un cliente real.
export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<'entrar' | 'recuperar'>('entrar');
  const [recuperarEnviado, setRecuperarEnviado] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!email || (modo === 'entrar' && !password)) {
      setError(modo === 'entrar' ? 'Completá email y contraseña.' : 'Completá tu email.');
      return;
    }

    setLoading(true);

    if (modo === 'recuperar') {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email);
      setLoading(false);
      if (authError) {
        setError(authError.message);
      } else {
        setRecuperarEnviado(true);
      }
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError(authError.message);
  }

  function cambiarModo(nuevo: 'entrar' | 'recuperar') {
    setModo(nuevo);
    setError(null);
    setRecuperarEnviado(false);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Image source={require('../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>ARGOS INSIGHTS</Text>
        <Text style={styles.title}>{modo === 'entrar' ? 'Iniciar sesión' : 'Recuperar contraseña'}</Text>

        {modo === 'recuperar' && !recuperarEnviado && (
          <Text style={styles.recuperarTexto}>
            Ingresá tu email y te mandamos un link para elegir una contraseña nueva.
          </Text>
        )}

        {modo === 'recuperar' && recuperarEnviado ? (
          <>
            <Text style={styles.recuperarOk}>
              Listo. Si {email} tiene una cuenta, te va a llegar un correo con las instrucciones.
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => cambiarModo('entrar')}>
              <Text style={styles.buttonText}>Volver a iniciar sesión</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.muted2}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            {modo === 'entrar' && (
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
            )}

            {modo === 'entrar' && (
              <TouchableOpacity onPress={() => cambiarModo('recuperar')} style={styles.olvideWrap}>
                <Text style={styles.olvideText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.buttonText}>{modo === 'entrar' ? 'Entrar' : 'Enviar instrucciones'}</Text>
              )}
            </TouchableOpacity>

            {modo === 'recuperar' && (
              <TouchableOpacity onPress={() => cambiarModo('entrar')}>
                <Text style={styles.switchText}>Volver a iniciar sesión</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, paddingVertical: 60 },
    logo: { width: 72, height: 67, marginBottom: 14 },
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
    recuperarTexto: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginBottom: 16, alignSelf: 'flex-start' },
    recuperarOk: { color: colors.greenLight, fontSize: 13, lineHeight: 19, marginBottom: 18, textAlign: 'center' },
    olvideWrap: { width: '100%', alignItems: 'flex-end', marginBottom: 16, marginTop: -4 },
    olvideText: { color: colors.greenLight, fontSize: 11.5 },
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
}
