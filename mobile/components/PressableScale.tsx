import { useRef } from 'react';
import { Animated, Easing, Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';

// Propiedades que definen cómo se acomoda ESTE elemento dentro de SU padre (no cómo
// se ven o cómo acomoda a sus propios hijos). Estas van sí o sí en el Pressable
// externo, porque es el que realmente es "hijo directo" del contenedor flex del
// padre (por ej. una fila con flexDirection: 'row').
const PROPIEDADES_DE_TAMANO = [
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'minHeight',
  'maxHeight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'alignSelf',
] as const;

// Envoltorio de Pressable que agrega una animación suave de "achicarse" al tocar,
// para que las tarjetas se sientan más vivas en vez de cambiar de golpe.
export default function PressableScale({
  style,
  children,
  ...props
}: PressableProps & { style?: ViewStyle | ViewStyle[]; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 120,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }

  function onPressOut() {
    Animated.timing(scale, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }

  // Sacamos solo las propiedades de "tamaño dentro del padre" para el Pressable externo.
  // El resto (fondo, borde, padding, flexDirection para acomodar sus propios hijos, etc.)
  // se queda en el Animated.View de adentro, como siempre — si no, quedaba duplicado
  // (doble fondo/borde) o rompía filas que dependen de flexDirection: 'row' acá.
  const plano: ViewStyle = StyleSheet.flatten(style) || {};
  const estiloExterno: ViewStyle = {};
  for (const key of PROPIEDADES_DE_TAMANO) {
    if (plano[key as keyof ViewStyle] !== undefined) {
      (estiloExterno as any)[key] = plano[key as keyof ViewStyle];
    }
  }

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} style={estiloExterno} {...props}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
