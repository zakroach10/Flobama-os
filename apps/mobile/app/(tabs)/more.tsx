import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { BrandLogo } from "@/src/components/BrandLogo";
import { Screen } from "@/src/components/Screen";
import {
  SITE_CONTACT_URL,
  SITE_PRIVACY_URL,
  VENUE,
} from "@/src/config";
import { colors, spacing, touchMin } from "@/src/theme";

type LinkRowProps = {
  label: string;
  detail?: string;
  onPress: () => void;
};

function LinkRow({ label, detail, onPress }: LinkRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
    >
      <Text style={styles.linkLabel}>{label}</Text>
      {detail ? <Text style={styles.linkDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

async function openExternal(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    // Linking failures are rare; rows remain tappable for retry.
  }
}

export default function MoreScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <BrandLogo width={150} />
      <Text style={styles.title}>More</Text>
      <Text style={styles.intro}>
        Public venue info from FloBama’s existing guest site. Hours and specials are not invented
        here — check the venue or ordering site for the latest.
      </Text>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Venue</Text>
        <Text style={styles.body}>
          {VENUE.legalName}
          {"\n"}
          {VENUE.street}
          {"\n"}
          {VENUE.cityStateZip}
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Contact & directions</Text>
        <LinkRow
          label="Call"
          detail={VENUE.phoneDisplay}
          onPress={() => void openExternal(`tel:${VENUE.phoneTel}`)}
        />
        <LinkRow
          label="Email"
          detail={VENUE.email}
          onPress={() => void openExternal(`mailto:${VENUE.email}`)}
        />
        <LinkRow
          label="Directions (Apple Maps)"
          onPress={() => void openExternal(VENUE.mapsUrl)}
        />
        <LinkRow
          label="Directions (Google Maps)"
          onPress={() => void openExternal(VENUE.googleMapsUrl)}
        />
        <LinkRow
          label="Contact page"
          onPress={() => void openExternal(SITE_CONTACT_URL)}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Legal</Text>
        <LinkRow
          label="Privacy Policy"
          detail="Opens the FloBama OS privacy page"
          onPress={() => void openExternal(SITE_PRIVACY_URL)}
        />
      </View>

      <Text style={styles.footnote}>
        Guest accounts, push notifications, loyalty, and in-app support chat are not part of this
        first release. Dedicated App Store support and terms URLs still need to be confirmed before
        submission.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  title: {
    fontFamily: "BebasNeue_400Regular",
    fontSize: 40,
    letterSpacing: 1,
    color: colors.text,
  },
  intro: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  block: {
    gap: spacing.xs,
  },
  blockTitle: {
    fontFamily: "SourceSans3_700Bold",
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  body: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  linkRow: {
    minHeight: touchMin,
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  linkLabel: {
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 16,
    color: colors.text,
  },
  linkDetail: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  footnote: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: colors.textDim,
  },
});
