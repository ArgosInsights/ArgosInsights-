// Colores y tipografía de Argos Insights.
// Estos valores tienen que coincidir siempre con /design-tokens.json en la raíz del repo
// (esa es la referencia que también usará la web). Si cambia uno, cambia el otro.
//
// Nota: la clave "white" representa el color de texto principal (no literalmente blanco).
// En modo día ese texto es oscuro. Se mantuvo el mismo nombre en las dos paletas para no
// tener que renombrar "colors.white" en cada pantalla.
export type ColorPalette = typeof darkColors;

export const darkColors = {
  bg: '#0a0a0a',
  panel: '#141414',
  card: '#161616',
  line: '#262626',
  green: '#7fb102',
  greenLight: '#a3e635',
  greenDark: '#3d6600',
  white: '#ffffff',
  muted: '#9a9a9a',
  muted2: '#707070',
  red: '#f87171',
  redBg: '#2a1414',
  yellow: '#facc15',
  yellowBg: '#2a2410',
  greenBg: '#132a10',
};

export const lightColors: ColorPalette = {
  bg: '#f4f5f1',
  panel: '#ffffff',
  card: '#ffffff',
  line: '#e3e5df',
  green: '#5c8a02',
  greenLight: '#5c8a02',
  greenDark: '#3d6600',
  white: '#14170f',
  muted: '#6b6f64',
  muted2: '#8d9184',
  red: '#dc2626',
  redBg: '#fbe4e4',
  yellow: '#a16207',
  yellowBg: '#faf0d6',
  greenBg: '#e7f2da',
};

// Se mantiene por si algún archivo viejo todavía la importa directo; lo normal
// de acá en adelante es usar useTheme() del ThemeContext para que reaccione al modo.
export const colors = darkColors;

// Poppins ya está cargada (ver App.tsx) y se aplica sola a través de components/Text.tsx.
