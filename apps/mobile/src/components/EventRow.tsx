import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";

import { coverLabel } from "@/src/lib/event-status";
import { colors, radii, spacing, touchMin } from "@/src/theme";
import type { PublicEventJson } from "@/src/types";

type Props = {
  event: PublicEventJson;
  badge?: string | null;
};

export function EventRow({ event, badge }: Props) {
  const cover = coverLabel(event);
  const artwork = event.artworkUrl?.trim() || null;

  return (
    <Link href={`/event/${event.id}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${event.name}, ${event.display}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {artwork ? (
          <Image source={{ uri: artwork }} style={styles.art} accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.artPlaceholder} accessibilityElementsHidden>
            <Text style={styles.artInitial}>{event.name.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.meta}>
          {badge ? <Text style={styles.badge}>{badge}</Text> : null}
          <Text style={styles.name} numberOfLines={2}>
            {event.name}
          </Text>
          <Text style={styles.when}>{event.display}</Text>
          {event.artists?.length ? (
            <Text style={styles.artists} numberOfLines={1}>
              {event.artists.join(" · ")}
            </Text>
          ) : null}
          {cover ? <Text style={styles.cover}>Cover: {cover}</Text> : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    minHeight: touchMin + 24,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  art: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  artPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  artInitial: {
    fontFamily: "BebasNeue_400Regular",
    fontSize: 28,
    color: colors.accent,
  },
  meta: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  badge: {
    fontFamily: "SourceSans3_700Bold",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.accent,
    marginBottom: 2,
  },
  name: {
    fontFamily: "SourceSans3_700Bold",
    fontSize: 18,
    color: colors.text,
  },
  when: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 14,
    color: colors.textMuted,
  },
  artists: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 13,
    color: colors.textDim,
  },
  cover: {
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
});
