import { Tabs } from "expo-router";
import { colors } from "../../src/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.line,
          height: 64,
          paddingTop: 10,
          paddingBottom: 10,
        },
        tabBarItemStyle: { justifyContent: "center" },
        tabBarIconStyle: { display: "none", width: 0, height: 0 },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: "#8a8178",
        tabBarLabelStyle: { fontSize: 13, fontWeight: "700", marginTop: 0 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Live" }} />
      <Tabs.Screen name="shows" options={{ title: "Shows" }} />
      <Tabs.Screen name="menu" options={{ title: "Menu" }} />
      <Tabs.Screen name="shop" options={{ title: "Shop" }} />
    </Tabs>
  );
}
