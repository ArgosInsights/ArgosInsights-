import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { colors } from '../constants/theme';
import HomeScreen from '../screens/HomeScreen';
import CobrosScreen from '../screens/CobrosScreen';
import CajaScreen from '../screens/CajaScreen';
import ExcelScreen from '../screens/ExcelScreen';
import PerfilScreen from '../screens/PerfilScreen';
import AdminUploadScreen from '../screens/AdminUploadScreen';

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

export default function MainTabs({
  userId,
  email,
  esAdmin,
}: {
  userId: string;
  email: string;
  esAdmin: boolean;
}) {
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
        {esAdmin && (
          <Tab.Screen
            name="Admin"
            options={{ tabBarIcon: ({ focused }) => <TabIcon nombre="upload" enfocado={focused} /> }}
          >
            {() => <AdminUploadScreen />}
          </Tab.Screen>
        )}
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
