import { useRef } from 'react';
import { Animated, Pressable, PressableProps, ViewStyle } from 'react-native';

// Envoltorio de Pressable que agrega una animación suave de "achicarse" al tocar,
// para que las tarjetas se sientan más vivas en vez de cambiar de golpe.
export default function PressableScale({
  style,
  children,
  ...props
}: PressableProps & { style?: ViewStyle | ViewStyle[]; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }

  function onPressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  }

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} {...props}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
