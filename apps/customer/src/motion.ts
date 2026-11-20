import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, type WithSpringConfig } from "react-native-reanimated";

const spring: WithSpringConfig = { damping: 18, stiffness: 220, mass: 0.6 };

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(Boolean(value));
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => setReduced(Boolean(value)));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

export function reveal(index: number, reduced: boolean) {
  if (reduced) return undefined;
  return FadeInDown.duration(340).delay(Math.min(index, 8) * 42);
}

export function usePressScale(reduced: boolean) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => {
      if (!reduced) scale.value = withSpring(0.97, spring);
    },
    onPressOut: () => {
      scale.value = withSpring(1, spring);
    },
  };
}

export function useTabShift(index: number, reduced: boolean) {
  const position = useSharedValue(index);
  useEffect(() => {
    position.value = reduced ? index : withSpring(index, { damping: 20, stiffness: 180 });
  }, [index, position, reduced]);
  return position;
}

export { Animated };
