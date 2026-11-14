import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CartProvider } from "../src/cart";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CartProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: "#1a120f", alignItems: "center" }}>
          <View style={{ flex: 1, width: "100%", maxWidth: 430, backgroundColor: colors.bg }}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.gold,
                headerTitleStyle: { color: colors.text },
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="show/[id]" options={{ title: "Show" }} />
              <Stack.Screen name="artist/[id]" options={{ title: "Artist" }} />
              <Stack.Screen name="recording/[id]" options={{ title: "Recording" }} />
              <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
            </Stack>
          </View>
        </View>
      </CartProvider>
    </SafeAreaProvider>
  );
}
