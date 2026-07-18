import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { colors } from '../constants/theme';
import HomeScreen from '../screens/HomeScreen';
import CobrosScreen from '../screens/CobrosScreen';
import CajaScreen from '../screens/CajaScreen';
import ExcelScreen from '../screens/ExcelScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Tab = createBottomTabNavigator();

// Tema oscuro para que el fondo de la navegación (entre pantallas) sea negro
// y no blanco por defecto.
const tema = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.panel, border: colors.line },
};

// Íconos de línea (outline), misma familia para todas las pestañas.
// Lista completa de nombres disponibles: https://icons.expo.fyi (filtrar por "Feather")
function TabIcon({ nombre, enfocado }: { nombre: keyof typeof Feather.glyphMap; enfocado: boolean }) {
  return <Feather name={nombre} size={20} color={enfocado ? colors.greenLight : colors.muted2} />;
}

export default function MainTabs({ userId, email }: { userId: string; email: string }) {
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
          options={{ tabBarIcon: ({ focused }) => <TabIcon nombre="home" enfocado={focused} /> }}
        >
          {({ navigation }) => <HomeScreen userId={userId} email={email} navigation={navigation} />}
        </Tab.Screen>
        <Tab.Screen
          name="Cobros"
          options={{ tabBarIcon: ({ focused }) => <TabIcon nombre="dollar-sign" enfocado={focused} /> }}
        >
          {() => <CobrosScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Caja"
          options={{ tabBarIcon: ({ focused }) => <TabIcon nombre="trending-up" enfocado={focused} /> }}
        >
          {() => <CajaScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Excel"
          options={{ tabBarIcon: ({ focused }) => <TabIcon nombre="file-text" enfocado={focused} /> }}
        >
          {() => <ExcelScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Perfil"
          options={{ tabBarIcon: ({ focused }) => <TabIcon nombre="user" enfocado={focused} /> }}
        >
          {() => <PerfilScreen userId={userId} email={email} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
