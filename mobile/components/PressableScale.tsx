import { useRef } from 'react';
import { Animated, Easing, Pressable, PressableProps, ViewStyle } from 'react-native';

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

  return (
    // El style (flex, width, margin, etc.) va también en el Pressable: es el hijo
    // directo del contenedor flex del padre, así que si solo se lo pasamos al
    // Animated.View de adentro, cosas como "flex: 1" no tienen ningún efecto
    // (terminan aplicadas un nivel mas adentro de lo que necesita el layout).
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} style={style} {...props}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
