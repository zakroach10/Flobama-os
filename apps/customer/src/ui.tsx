import { useRouter } from "expo-router";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { reveal, usePressScale, useReducedMotion } from "./motion";
import { colors, fonts, radii, space, type as typeScale } from "./theme";

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
        style={styles.scroll}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.gold} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Reveal({ index, children }: { index: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return <Animated.View entering={reveal(index, reduced)}>{children}</Animated.View>;
}

export function PressableScale({
  children,
  onPress,
  disabled,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const reduced = useReducedMotion();
  const press = usePressScale(reduced);
  return (
    <Animated.View style={[press.style, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        disabled={disabled}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function SampleNote({ show }: { show: boolean }) {
  if (!show) return null;
  return <Text style={styles.sample}>Sample listings until FloBama OS is connected.</Text>;
}

export function Eyebrow({ children }: { children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Card({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  if (!onPress) return <View style={styles.card}>{children}</View>;
  return (
    <PressableScale onPress={onPress} style={styles.cardPress}>
      <View style={styles.card}>{children}</View>
    </PressableScale>
  );
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Display({ children }: { children: string }) {
  return <Text style={styles.display}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function GoldButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityLabel={label}>
      <View style={[styles.button, disabled && styles.disabled]}>
        <Text style={styles.buttonText}>{label}</Text>
      </View>
    </PressableScale>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

export function BackButton() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <PressableScale
      accessibilityLabel="Go back"
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/");
      }}
      style={[styles.back, { top: insets.top + space.sm, left: space.lg }]}
    >
      <Text style={styles.backMark}>←</Text>
    </PressableScale>
  );
}

export function Detail({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.safe}>
      <Screen>
        <View style={styles.detailPad}>{children}</View>
      </Screen>
      <BackButton />
    </View>
  );
}

const logo = require("../assets/flobama-logo.png");

export function LiveMark() {
  return <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="FloBama" />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: colors.bg },
  scroll: { flex: 1, minHeight: 0 },
  content: { padding: space.xl, paddingBottom: 96, gap: space.lg },
  detailPad: { paddingTop: space.xxxl, gap: space.lg },
  sample: { color: colors.muted, fontFamily: fonts.text, fontSize: typeScale.small, lineHeight: 20 },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.textStrong,
    fontSize: typeScale.label,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  cardPress: { borderRadius: radii.md },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: space.lg,
    gap: space.sm,
  },
  title: { color: colors.text, fontFamily: fonts.displaySoft, fontSize: typeScale.card, lineHeight: 26 },
  display: { color: colors.text, fontFamily: fonts.display, fontSize: typeScale.title, lineHeight: 34 },
  muted: { color: colors.muted, fontFamily: fonts.text, fontSize: typeScale.body, lineHeight: 22 },
  button: {
    backgroundColor: colors.orange,
    borderRadius: radii.pill,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.ink, fontFamily: fonts.textStrong, fontSize: typeScale.body, letterSpacing: 0.2 },
  error: { color: "#ffb4a8", fontFamily: fonts.text, fontSize: typeScale.small },
  back: {
    position: "absolute",
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  backMark: { color: colors.gold, fontSize: 20, lineHeight: 22, fontFamily: fonts.textStrong },
  logo: { width: 168, height: 52 },
});
