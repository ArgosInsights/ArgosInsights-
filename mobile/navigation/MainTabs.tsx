import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useTheme } from '../lib/ThemeContext';
import HomeScreen from '../screens/HomeScreen';
import CobrosScreen from '../screens/CobrosScreen';
import CajaScreen from '../screens/CajaScreen';
import CicloScreen from '../screens/CicloScreen';
import ExcelScreen from '../screens/ExcelScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Tab = createBottomTabNavigator();

// Íconos de línea (outline), misma familia para todas las pestañas.
// Lista completa de nombres disponibles: https://icons.expo.fyi (filtrar por "Feather")
function TabIcon({
  nombre,
  enfocado,
  activo,
  inactivo,
}: {
  nombre: keyof typeof Feather.glyphMap;
  enfocado: boolean;
  activo: string;
  inactivo: string;
}) {
  return <Feather name={nombre} size={20} color={enfocado ? activo : inactivo} />;
}

export default function MainTabs({ userId, email }: { userId: string; email: string }) {
  const { colors, modo } = useTheme();

  // Tema de navegación acorde al modo día/noche, para que el fondo entre
  // pantallas y el color base coincidan y no haya flashes de un tema contra otro.
  const tema = {
    ...(modo === 'dia' ? DefaultTheme : DarkTheme),
    colors: {
      ...(modo === 'dia' ? DefaultTheme.colors : DarkTheme.colors),
      background: colors.bg,
      card: colors.panel,
      border: colors.line,
    },
  };

  return (
    <NavigationContainer theme={tema}>
      <Tab.Navigator
        // Por defecto, React Navigation "desmonta" la vista nativa de las pestañas
        // inactivas para ahorrar memoria. Eso hace que al volver a una pestaña se
        // cree de cero y se vea un flash antes de pintar el fondo oscuro.
        // Con esto, las pestañas quedan siempre montadas.
        detachInactiveScreens={false}
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line },
          tabBarActiveTintColor: colors.greenLight,
          tabBarInactiveTintColor: colors.muted2,
          tabBarLabelStyle: { fontSize: 10 },
          // La animación nativa de cruce (fade/shift) tiene un bug conocido en iOS
          // que muestra un flash blanco durante la transición. Sin animación, el
          // cambio es instantáneo y sin ese destello.
          animation: 'none',
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tab.Screen
          name="Inicio"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon nombre="home" enfocado={focused} activo={colors.greenLight} inactivo={colors.muted2} />
            ),
          }}
        >
          {({ navigation }) => <HomeScreen userId={userId} email={email} navigation={navigation} />}
        </Tab.Screen>
        <Tab.Screen
          name="Cobros"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon nombre="dollar-sign" enfocado={focused} activo={colors.greenLight} inactivo={colors.muted2} />
            ),
          }}
        >
          {() => <CobrosScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Caja"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon nombre="trending-up" enfocado={focused} activo={colors.greenLight} inactivo={colors.muted2} />
            ),
          }}
        >
          {() => <CajaScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Ciclo"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon nombre="repeat" enfocado={focused} activo={colors.greenLight} inactivo={colors.muted2} />
            ),
          }}
        >
          {() => <CicloScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Excel"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon nombre="file-text" enfocado={focused} activo={colors.greenLight} inactivo={colors.muted2} />
            ),
          }}
        >
          {() => <ExcelScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Perfil"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon nombre="user" enfocado={focused} activo={colors.greenLight} inactivo={colors.muted2} />
            ),
          }}
        >
          {() => <PerfilScreen userId={userId} email={email} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
