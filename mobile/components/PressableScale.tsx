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
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} {...props}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
