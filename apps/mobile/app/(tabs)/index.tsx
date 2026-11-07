import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchTonight, PublicApiError } from "@/src/api/events";
import { BrandLogo } from "@/src/components/BrandLogo";
import { EventRow } from "@/src/components/EventRow";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { StateMessage } from "@/src/components/StateMessage";
import { VENUE_TIMEZONE_LABEL } from "@/src/config";
import { formatVenueClock, isHappeningNow } from "@/src/lib/event-status";
import { openOnlineOrdering } from "@/src/lib/ordering";
import { colors, spacing } from "@/src/theme";
import type { PublicEventJson, PublicNowResponse } from "@/src/types";

export default function TonightScreen() {
  const [data, setData] = useState<PublicNowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState(formatVenueClock());

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await fetchTonight();
      setData(result);
    } catch (err) {
      const message = err instanceof PublicApiError ? err.message : "Could not load tonight’s shows.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setClock(formatVenueClock()), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = data?.today ?? [];
  const featured: PublicEventJson | null =
    data?.nowPlaying ?? today.find((event) => isHappeningNow(event)) ?? data?.next ?? today[0] ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load("refresh")}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <BrandLogo width={200} />
          <Text style={styles.kicker}>Tonight · {VENUE_TIMEZONE_LABEL}</Text>
          <Text style={styles.clock}>{clock}</Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="Order Online"
            onPress={() => void openOnlineOrdering()}
            accessibilityHint="Opens FloBama’s online ordering site in your browser"
          />
          <PrimaryButton
            label="Upcoming Events"
            variant="secondary"
            onPress={() => router.push("/events")}
          />
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Loading tonight’s lineup…</Text>
          </View>
        ) : null}

        {error ? (
          <StateMessage
            title="Couldn’t load tonight"
            body={error}
            actionLabel="Try again"
            onAction={() => void load("initial")}
          />
        ) : null}

        {!loading && !error && today.length === 0 ? (
          <StateMessage
            title="No public events listed tonight"
            body="There’s nothing published for tonight in the public calendar. That doesn’t mean the venue is closed — check upcoming events for what’s next."
            actionLabel="See upcoming events"
            onAction={() => router.push("/events")}
          />
        ) : null}

        {!loading && !error && featured ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {data?.nowPlaying || isHappeningNow(featured) ? "Now on" : "Tonight"}
            </Text>
            <EventRow
              event={featured}
              badge={
                data?.nowPlaying?.id === featured.id || isHappeningNow(featured)
                  ? "In progress"
                  : null
              }
            />
          </View>
        ) : null}

        {!loading && !error && today.length > 1 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Also tonight</Text>
            {today
              .filter((event) => event.id !== featured?.id)
              .map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  badge={isHappeningNow(event) ? "In progress" : null}
                />
              ))}
          </View>
        ) : null}

        <Pressable onPress={() => router.push("/order")} accessibilityRole="link">
          <Text style={styles.orderNote}>
            Ordering opens FloBama’s online ordering site in your browser — not inside this app.
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  kicker: {
    fontFamily: "SourceSans3_700Bold",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.accent,
    marginTop: spacing.sm,
  },
  clock: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 15,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: "BebasNeue_400Regular",
    fontSize: 28,
    letterSpacing: 1,
    color: colors.text,
  },
  center: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    fontFamily: "SourceSans3_400Regular",
    color: colors.textMuted,
  },
  orderNote: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: colors.textDim,
    textAlign: "center",
  },
});
