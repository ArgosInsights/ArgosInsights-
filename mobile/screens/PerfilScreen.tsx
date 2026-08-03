import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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

// Factor TOTP tal como lo devuelve supabase.auth.mfa.listFactors().
type MfaFactor = { id: string; status: 'verified' | 'unverified'; factor_type: string };

export default function PerfilScreen({ userId, email }: { userId: string; email: string }) {
  const { colors, modo, toggleModo } = useTheme();
  const styles = getStyles(colors);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // ---- Verificación en dos pasos (2FA/TOTP) — opcional, la activa quien quiera desde acá.
  // No hay QR (evita sumar una dependencia nativa nueva): se muestra el código para
  // ingresar a mano en la app authenticator, que es una opción estándar en todas ellas.
  const [factores, setFactores] = useState<MfaFactor[]>([]);
  const [factoresListos, setFactoresListos] = useState(false);
  const [mfaPaso, setMfaPaso] = useState<'idle' | 'verificando'>('idle');
  const [enroll, setEnroll] = useState<{ id: string; secret: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  function cargarFactores() {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setFactores((data?.totp as MfaFactor[]) ?? []);
      setFactoresListos(true);
    });
  }

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
    cargarFactores();
  }, [userId]);

  async function activar2FA() {
    setMfaError(null);
    setMfaLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setMfaLoading(false);
    if (error || !data) {
      setMfaError(error?.message ?? 'No pudimos iniciar la activación. Probá de nuevo.');
      return;
    }
    setEnroll({ id: data.id, secret: data.totp.secret });
    setMfaPaso('verificando');
  }

  async function cancelarEnroll() {
    if (enroll) supabase.auth.mfa.unenroll({ factorId: enroll.id }).catch(() => {});
    setEnroll(null);
    setCodigo('');
    setMfaError(null);
    setMfaPaso('idle');
  }

  async function confirmarCodigo() {
    if (!enroll) return;
    if (codigo.trim().length !== 6) {
      setMfaError('Ingresá el código de 6 dígitos de tu app authenticator.');
      return;
    }
    setMfaError(null);
    setMfaLoading(true);
    const { data: challenge, error: errChallenge } = await supabase.auth.mfa.challenge({
      factorId: enroll.id,
    });
    if (errChallenge || !challenge) {
      setMfaLoading(false);
      setMfaError(errChallenge?.message ?? 'No pudimos verificar el código. Probá de nuevo.');
      return;
    }
    const { error: errVerify } = await supabase.auth.mfa.verify({
      factorId: enroll.id,
      challengeId: challenge.id,
      code: codigo.trim(),
    });
    setMfaLoading(false);
    if (errVerify) {
      setMfaError('Código incorrecto. Revisá la hora de tu celular y probá de nuevo.');
      return;
    }
    setEnroll(null);
    setCodigo('');
    setMfaPaso('idle');
    cargarFactores();
  }

  function desactivar2FA(factorId: string) {
    Alert.alert(
      'Desactivar verificación en dos pasos',
      'Tu cuenta va a quedar protegida solo con tu contraseña. ¿Seguro que querés desactivarla?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            setMfaLoading(true);
            await supabase.auth.mfa.unenroll({ factorId });
            setMfaLoading(false);
            cargarFactores();
          },
        },
      ]
    );
  }

  const factorVerificado = factores.find((f) => f.status === 'verified');

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

        <View style={styles.card}>
          <View style={styles.seguridadHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name="shield" size={16} color={colors.greenLight} />
              <View>
                <Text style={styles.temaLabel}>Verificación en dos pasos</Text>
                <Text style={styles.temaSub}>
                  {!factoresListos
                    ? 'Revisando…'
                    : factorVerificado
                    ? 'Activada'
                    : 'Desactivada'}
                </Text>
              </View>
            </View>
            {factoresListos && mfaPaso === 'idle' && (
              <TouchableOpacity
                disabled={mfaLoading}
                onPress={() =>
                  factorVerificado ? desactivar2FA(factorVerificado.id) : activar2FA()
                }
              >
                {mfaLoading ? (
                  <ActivityIndicator color={colors.greenLight} size="small" />
                ) : (
                  <Text style={[styles.mfaToggle, factorVerificado && styles.mfaToggleOff]}>
                    {factorVerificado ? 'Desactivar' : 'Activar'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {mfaPaso === 'verificando' && enroll && (
            <View style={styles.mfaBox}>
              <Text style={styles.mfaTexto}>
                Agregá esta cuenta en tu app authenticator (Google Authenticator, Authy, etc.)
                usando "Ingresar código manualmente" y este código:
              </Text>
              <Text selectable style={styles.mfaSecret}>
                {enroll.secret}
              </Text>
              <Text style={styles.mfaTexto}>Después escribí acá el código de 6 dígitos que te muestre:</Text>
              <TextInput
                style={styles.mfaInput}
                placeholder="000000"
                placeholderTextColor={colors.muted2}
                keyboardType="number-pad"
                maxLength={6}
                value={codigo}
                onChangeText={setCodigo}
              />
              {mfaError && <Text style={styles.error}>{mfaError}</Text>}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity style={styles.mfaCancelButton} onPress={cancelarEnroll}>
                  <Text style={styles.mfaCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mfaConfirmButton, mfaLoading && { opacity: 0.6 }]}
                  onPress={confirmarCodigo}
                  disabled={mfaLoading}
                >
                  {mfaLoading ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : (
                    <Text style={styles.buttonText}>Confirmar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    seguridadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    mfaToggle: { color: colors.greenLight, fontSize: 12.5, fontWeight: '700' },
    mfaToggleOff: { color: colors.red },
    mfaBox: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
    mfaTexto: { color: colors.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 },
    mfaSecret: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 1.5,
      textAlign: 'center',
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    mfaInput: {
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 10,
      padding: 12,
      color: colors.white,
      fontSize: 16,
      letterSpacing: 4,
      textAlign: 'center',
      marginBottom: 10,
    },
    mfaCancelButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    mfaCancelText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
    mfaConfirmButton: {
      flex: 1,
      backgroundColor: colors.green,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    error: { color: colors.red, fontSize: 12, marginBottom: 2 },
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
