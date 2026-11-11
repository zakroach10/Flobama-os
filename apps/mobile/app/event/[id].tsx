import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchEvent, PublicApiError } from "@/src/api/events";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { StateMessage } from "@/src/components/StateMessage";
import { VENUE, VENUE_TIMEZONE_LABEL } from "@/src/config";
import { coverLabel } from "@/src/lib/event-status";
import { sharePublicEvent } from "@/src/lib/share-event";
import { isVerifiedProductionTicketUrl } from "@/src/lib/tickets";
import { colors, radii, spacing } from "@/src/theme";
import type { PublicEventJson } from "@/src/types";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<PublicEventJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || typeof id !== "string") {
      setError("Missing event id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchEvent(id);
      setEvent(result);
    } catch (err) {
      const message = err instanceof PublicApiError ? err.message : "Could not load this event.";
      setError(message);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error || !event) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
        <View style={styles.pad}>
          <StateMessage
            title="Event unavailable"
            body={error ?? "This event was not found in the public calendar."}
            actionLabel="Try again"
            onAction={() => void load()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const cover = coverLabel(event);
  const ticketUrl = isVerifiedProductionTicketUrl(event.ticketUrl) ? event.ticketUrl : null;
  const artwork = event.artworkUrl?.trim() || null;
  const description = event.description?.trim() || null;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {artwork ? (
          <Image source={{ uri: artwork }} style={styles.art} accessibilityLabel={`${event.name} artwork`} />
        ) : null}

        <Text style={styles.name}>{event.name}</Text>
        <Text style={styles.when}>
          {event.display}
          {"\n"}
          {VENUE_TIMEZONE_LABEL}
        </Text>

        {event.locationLabel || VENUE.name ? (
          <Text style={styles.meta}>{event.locationLabel || VENUE.name}</Text>
        ) : null}

        {cover ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>Cover: {cover}</Text>
          </View>
        ) : (
          <Text style={styles.metaDim}>Cover not listed for this event.</Text>
        )}

        {event.artists?.length ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Lineup</Text>
            <Text style={styles.body}>{event.artists.join("\n")}</Text>
          </View>
        ) : null}

        {description ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>About</Text>
            <Text style={styles.body}>{description}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton label="Share" variant="secondary" onPress={() => void sharePublicEvent(event)} />
          {ticketUrl ? (
            <PrimaryButton
              label="Get tickets"
              onPress={() => void Linking.openURL(ticketUrl)}
              accessibilityHint="Opens the verified ticket checkout in your browser"
            />
          ) : null}
        </View>

        {!ticketUrl && event.ticketed ? (
          <Text style={styles.metaDim}>
            This listing is marked ticketed, but no verified production checkout link is available
            in the public API.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  pad: {
    padding: spacing.lg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  art: {
    width: "100%",
    aspectRatio: 1.4,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  name: {
    fontFamily: "BebasNeue_400Regular",
    fontSize: 40,
    letterSpacing: 1,
    color: colors.text,
  },
  when: {
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 17,
    lineHeight: 26,
    color: colors.text,
  },
  meta: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 15,
    color: colors.textMuted,
  },
  metaDim: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 14,
    color: colors.textDim,
  },
  chip: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  chipText: {
    fontFamily: "SourceSans3_700Bold",
    fontSize: 14,
    color: colors.accent,
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
  },
  body: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
