import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/src/theme";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ("top" | "right" | "bottom" | "left")[];
};

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  edges = ["top", "left", "right"],
}: Props) {
  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
  },
});
