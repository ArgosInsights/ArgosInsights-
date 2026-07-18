import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { Text } from 'react-native';
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

function TabIcon({ simbolo, enfocado }: { simbolo: string; enfocado: boolean }) {
  return (
    <Text style={{ fontSize: 16, color: enfocado ? colors.greenLight : colors.muted2 }}>{simbolo}</Text>
  );
}

export default function MainTabs({ userId, email }: { userId: string; email: string }) {
  return (
    <NavigationContainer theme={tema}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line },
          tabBarActiveTintColor: colors.greenLight,
          tabBarInactiveTintColor: colors.muted2,
          tabBarLabelStyle: { fontSize: 10 },
        }}
      >
        <Tab.Screen
          name="Inicio"
          options={{ tabBarIcon: ({ focused }) => <TabIcon simbolo="⌂" enfocado={focused} /> }}
        >
          {() => <HomeScreen userId={userId} email={email} />}
        </Tab.Screen>
        <Tab.Screen
          name="Cobros"
          options={{ tabBarIcon: ({ focused }) => <TabIcon simbolo="$" enfocado={focused} /> }}
        >
          {() => <CobrosScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Caja"
          options={{ tabBarIcon: ({ focused }) => <TabIcon simbolo="↗" enfocado={focused} /> }}
        >
          {() => <CajaScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Excel"
          options={{ tabBarIcon: ({ focused }) => <TabIcon simbolo="☰" enfocado={focused} /> }}
        >
          {() => <ExcelScreen userId={userId} />}
        </Tab.Screen>
        <Tab.Screen
          name="Perfil"
          options={{ tabBarIcon: ({ focused }) => <TabIcon simbolo="◎" enfocado={focused} /> }}
        >
          {() => <PerfilScreen userId={userId} email={email} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
