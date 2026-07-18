import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ColorPalette, darkColors, lightColors } from '../constants/theme';

export type ModoTema = 'dia' | 'noche';

const STORAGE_KEY = 'argos_modo_tema';

type ThemeContextValue = {
  modo: ModoTema;
  colors: ColorPalette;
  toggleModo: () => void;
  listo: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  modo: 'noche',
  colors: darkColors,
  toggleModo: () => {},
  listo: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [modo, setModo] = useState<ModoTema>('noche');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((guardado) => {
      if (guardado === 'dia' || guardado === 'noche') setModo(guardado);
      setListo(true);
    });
  }, []);

  function toggleModo() {
    setModo((actual) => {
      const nuevo = actual === 'noche' ? 'dia' : 'noche';
      AsyncStorage.setItem(STORAGE_KEY, nuevo).catch(() => {});
      return nuevo;
    });
  }

  const value = useMemo(
    () => ({ modo, colors: modo === 'dia' ? lightColors : darkColors, toggleModo, listo }),
    [modo, listo]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
