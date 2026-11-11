import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing } from "@/src/theme";

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StateMessage({ title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} variant="secondary" style={styles.btn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontFamily: "BebasNeue_400Regular",
    fontSize: 32,
    color: colors.text,
    letterSpacing: 1,
  },
  body: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  btn: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
  },
});
