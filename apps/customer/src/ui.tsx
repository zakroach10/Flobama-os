import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./theme";

const logo = require("../assets/flobama-logo.png");

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.gold} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function BrandHeader({ kicker }: { kicker?: string }) {
  return (
    <View style={styles.header}>
      <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="FloBama" />
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
    </View>
  );
}

export function SampleNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Text style={styles.sample}>
      Sample listings until FloBama OS is connected. Menu prices and merch match the starter catalog.
    </Text>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Card({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  if (!onPress) return <View style={styles.card}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function GoldButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, (pressed || disabled) && styles.pressed]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  header: { alignItems: "center", gap: 8, marginBottom: 4 },
  logo: { width: 240, height: 72 },
  kicker: { color: colors.gold, letterSpacing: 3, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  sample: {
    color: colors.muted,
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    lineHeight: 18,
  },
  section: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  pressed: { opacity: 0.75 },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  button: {
    backgroundColor: colors.orange,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: colors.black, fontWeight: "800", letterSpacing: 0.6, fontSize: 16 },
  error: { color: "#ffb4a8" },
});
