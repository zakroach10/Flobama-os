import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from "@expo-google-fonts/outfit";
import { Syne_700Bold, Syne_800ExtraBold } from "@expo-google-fonts/syne";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CartProvider } from "../src/cart";
import { colors } from "../src/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <CartProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: "#070605", alignItems: "center" }}>
          <View style={{ flex: 1, width: "100%", maxWidth: 430, backgroundColor: colors.bg }}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="show/[id]" />
              <Stack.Screen name="artist/[id]" />
              <Stack.Screen name="recording/[id]" />
              <Stack.Screen name="checkout" />
            </Stack>
          </View>
        </View>
      </CartProvider>
    </SafeAreaProvider>
  );
}
