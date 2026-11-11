import { SymbolView } from "expo-symbols";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

import { colors } from "@/src/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.backgroundElevated,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: "SourceSans3_600SemiBold",
          fontSize: 11,
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tonight",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "moon.stars.fill", android: "nightlife", web: "nightlife" }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "calendar", android: "event", web: "event" }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="order"
        options={{
          title: "Order",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "fork.knife", android: "restaurant", web: "restaurant" }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "ellipsis.circle", android: "more_horiz", web: "more_horiz" }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
    </Tabs>
  );
}
