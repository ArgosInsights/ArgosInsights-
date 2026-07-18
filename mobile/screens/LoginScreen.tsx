import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
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

// Pantalla de login. El cliente se registra solo, pero la cuenta arranca "pendiente de
// aprobación" (columna profiles.aprobado, default false) hasta que un admin la revise y
// la apruebe a mano desde Supabase (Table Editor > profiles > aprobado = true). Mientras
// no esté aprobada, App.tsx la frena en una pantalla de espera en vez de dejarla entrar
// a los datos. El trigger handle_new_user ya arma la fila en "profiles" con lo que se
// manda acá (full_name/company_name/company_type) como raw_user_meta_data.
export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
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
  const [modo, setModo] = useState<'entrar' | 'crear' | 'recuperar'>('entrar');
  const [recuperarEnviado, setRecuperarEnviado] = useState(false);
  const [aceptaPoliticas, setAceptaPoliticas] = useState(false);

  const URL_POLITICA = 'https://argosinsights.org/privacidad.html';

  async function handleSubmit() {
    setError(null);

    if (modo === 'recuperar') {
      if (!email) {
        setError('Completá tu email.');
        return;
      }
      setLoading(true);
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email);
      setLoading(false);
      if (authError) {
        setError(authError.message);
      } else {
        setRecuperarEnviado(true);
      }
      return;
    }

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
    if (modo === 'crear' && !aceptaPoliticas) {
      setError('Tenés que aceptar la política de privacidad para crear tu cuenta.');
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
            // (handle_new_user) lo toma de ahí y lo guarda en la tabla profiles. La fila
            // queda con aprobado = false hasta que un admin la apruebe.
            options: {
              data: { full_name: nombre, company_name: empresa, company_type: tipoEmpresa },
            },
          });
    setLoading(false);
    if (authError) setError(authError.message);
  }

  function cambiarModo(nuevo: 'entrar' | 'crear' | 'recuperar') {
    setModo(nuevo);
    setError(null);
    setConfirmPassword('');
    setRecuperarEnviado(false);
    setAceptaPoliticas(false);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Image source={require('../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>ARGOS INSIGHTS</Text>
        <Text style={styles.title}>
          {modo === 'entrar' ? 'Iniciar sesión' : modo === 'crear' ? 'Crear cuenta' : 'Recuperar contraseña'}
        </Text>

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

            {modo !== 'recuperar' && (
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

            {modo === 'entrar' && (
              <TouchableOpacity onPress={() => cambiarModo('recuperar')} style={styles.olvideWrap}>
                <Text style={styles.olvideText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            )}

            {modo === 'crear' && (
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAceptaPoliticas((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, aceptaPoliticas && styles.checkboxChecked]}>
                  {aceptaPoliticas && <Feather name="check" size={13} color={colors.bg} />}
                </View>
                <Text style={styles.checkboxText}>
                  Acepto la{' '}
                  <Text style={styles.checkboxLink} onPress={() => Linking.openURL(URL_POLITICA)}>
                    política de privacidad
                  </Text>
                </Text>
              </TouchableOpacity>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.buttonText}>
                  {modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Enviar instrucciones'}
                </Text>
              )}
            </TouchableOpacity>

            {modo === 'recuperar' ? (
              <TouchableOpacity onPress={() => cambiarModo('entrar')}>
                <Text style={styles.switchText}>Volver a iniciar sesión</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => cambiarModo(modo === 'crear' ? 'entrar' : 'crear')}>
                <Text style={styles.switchText}>
                  {modo === 'crear' ? '¿Ya tienes cuenta? Entrar' : '¿No tienes cuenta? Regístrate'}
                </Text>
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
    checkboxRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 16 },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    checkboxChecked: { backgroundColor: colors.green, borderColor: colors.green },
    checkboxText: { color: colors.muted, fontSize: 12.5, flex: 1, flexShrink: 1 },
    checkboxLink: { color: colors.greenLight, textDecorationLine: 'underline' },
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
