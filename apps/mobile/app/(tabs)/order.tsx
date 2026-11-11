import { StyleSheet, Text, View } from "react-native";

import { BrandLogo } from "@/src/components/BrandLogo";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { Screen } from "@/src/components/Screen";
import { ORDERING_URL } from "@/src/config";
import { openOnlineOrdering } from "@/src/lib/ordering";
import { colors, spacing } from "@/src/theme";

export default function OrderScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <BrandLogo width={160} />
        <Text style={styles.title}>Order Online</Text>
        <Text style={styles.body}>
          Food and drinks order through FloBama’s online ordering site. Tapping the button opens
          that site in your system browser so checkout stays on their secure page.
        </Text>
      </View>

      <PrimaryButton
        label="Order Online"
        onPress={() => void openOnlineOrdering()}
        accessibilityHint="Opens FloBama online ordering in your browser"
      />

      <Text style={styles.footnote}>
        Destination: {ORDERING_URL}
        {"\n"}
        This app does not take payments or show a menu. If the link fails to open, try again when
        you have a network connection.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  hero: {
    gap: spacing.md,
    alignItems: "flex-start",
  },
  title: {
    fontFamily: "BebasNeue_400Regular",
    fontSize: 44,
    letterSpacing: 1,
    color: colors.text,
    marginTop: spacing.sm,
  },
  body: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 17,
    lineHeight: 26,
    color: colors.textMuted,
  },
  footnote: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: colors.textDim,
  },
});
