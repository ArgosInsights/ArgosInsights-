import { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { supabase } from './lib/supabase';
import { ThemeProvider, useTheme } from './lib/ThemeContext';
import MainTabs from './navigation/MainTabs';
import LoginScreen from './screens/LoginScreen';
import PendienteScreen from './screens/PendienteScreen';

// Evita que la pantalla se ponga en blanco un instante antes de que todo esté listo
// (fuentes cargadas, sesión revisada). La sacamos a mano en IntroVideo cuando termina.
SplashScreen.preventAutoHideAsync().catch(() => {});

const logoIntro = require('./assets/argos-logo-intro.mp4');

// Pantalla de carga con el logo animado, mientras se revisa la sesión y cargan las fuentes.
// Siempre en negro puro (coincide con el fondo del propio video), sin importar el modo
// día/noche elegido — es la misma intro de marca para todos.
function IntroVideo() {
  const player = useVideoPlayer(logoIntro, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={styles.loading}>
      <StatusBar style="light" />
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />
    </View>
  );
}

function AppContent() {
  const { modo, listo: temaListo } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [sesionLista, setSesionLista] = useState(false);
  const [aprobado, setAprobado] = useState<boolean | null>(null);
  const [mostrarIntro, setMostrarIntro] = useState(true);
  const introOpacity = useRef(new Animated.Value(1)).current;

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Un admin siempre pasa (las cuentas de admin no las crea el auto-registro), un
  // cliente necesita que profiles.aprobado esté en true.
  async function revisarAprobacion(userId: string) {
    const { data } = await supabase.from('profiles').select('aprobado, role').eq('id', userId).single();
    setAprobado(data ? data.aprobado || data.role === 'admin' : false);
  }

  useEffect(() => {
    // Al abrir la app, revisa si ya había una sesión guardada (para no pedir
    // login cada vez que se abre la app).
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSesionLista(true);
      if (data.session) revisarAprobacion(data.session.user.id);
    });

    // Se ejecuta cada vez que el usuario entra o sale (login/logout).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAprobado(null);
      if (newSession) revisarAprobacion(newSession.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const listo = fontsLoaded && sesionLista && temaListo && (!session || aprobado !== null);

  // Cuando todo está listo, en vez de cortar el video de golpe lo dejamos
  // desvanecerse lentamente mientras la pantalla de abajo ya está lista para verse.
  useEffect(() => {
    if (listo && mostrarIntro) {
      Animated.timing(introOpacity, {
        toValue: 0,
        duration: 900,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMostrarIntro(false));
    }
  }, [listo]);

  return (
    <>
      <StatusBar style={modo === 'dia' ? 'dark' : 'light'} />
      {listo &&
        (session ? (
          aprobado ? (
            <MainTabs userId={session.user.id} email={session.user.email ?? ''} />
          ) : (
            <PendienteScreen onReintentar={() => revisarAprobacion(session.user.id)} />
          )
        ) : (
          <LoginScreen />
        ))}
      {mostrarIntro && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: introOpacity }]} pointerEvents="none">
          <IntroVideo />
        </Animated.View>
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  // Negro puro (no colors.bg) para que coincida exacto con el fondo del video
  // y no se note el borde del cuadro.
  loading: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  video: { width: '70%', aspectRatio: 1 },
});
