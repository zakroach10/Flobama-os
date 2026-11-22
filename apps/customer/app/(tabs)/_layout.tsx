import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "../../src/motion";
import { colors, fonts, type as typeScale } from "../../src/theme";

const TABS = [
  { name: "index", title: "Live", mark: "●" },
  { name: "shows", title: "Shows", mark: "☰" },
  { name: "menu", title: "Menu", mark: "🍽" },
  { name: "shop", title: "Shop", mark: "⌂" },
] as const;

function FloTabBar({
  state,
  navigateToTab,
}: {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (routeKey: string) => void;
}) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const barWidth = Math.min(width, 430);
  const tabWidth = barWidth / state.routes.length;
  const offset = useSharedValue(state.index);

  useEffect(() => {
    offset.value = reduced ? state.index : withSpring(state.index, { damping: 20, stiffness: 190 });
  }, [offset, reduced, state.index]);

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * tabWidth + tabWidth * 0.28 }],
  }));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Animated.View style={[styles.indicator, { width: tabWidth * 0.44 }, indicator]} />
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta = TABS.find((tab) => tab.name === route.name) ?? { title: route.name, mark: "•" };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={meta.title}
            onPress={() => {
              if (!focused) navigateToTab(route.key);
            }}
            style={styles.tab}
          >
            <Text style={[styles.mark, focused && styles.markOn]}>{meta.mark}</Text>
            <Text style={[styles.label, focused && styles.labelOn]}>{meta.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloTabBar state={props.state} navigateToTab={props.navigateToTab} />}>
      <Tabs.Screen name="index" options={{ title: "Live" }} />
      <Tabs.Screen name="shows" options={{ title: "Shows" }} />
      <Tabs.Screen name="menu" options={{ title: "Menu" }} />
      <Tabs.Screen name="shop" options={{ title: "Shop" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.raised,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  indicator: {
    position: "absolute",
    top: 0,
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  tab: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 6 },
  mark: { color: colors.muted, fontSize: 14, lineHeight: 16 },
  markOn: { color: colors.gold },
  label: { color: colors.muted, fontFamily: fonts.textMedium, fontSize: typeScale.label },
  labelOn: { color: colors.text, fontFamily: fonts.textStrong },
});
