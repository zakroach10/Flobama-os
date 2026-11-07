import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchUpcomingEvents, PublicApiError } from "@/src/api/events";
import { EventRow } from "@/src/components/EventRow";
import { StateMessage } from "@/src/components/StateMessage";
import { VENUE_TIMEZONE_LABEL } from "@/src/config";
import { colors, spacing } from "@/src/theme";
import type { PublicEventJson } from "@/src/types";

export default function EventsScreen() {
  const [events, setEvents] = useState<PublicEventJson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const list = await fetchUpcomingEvents();
      setEvents(list);
    } catch (err) {
      const message = err instanceof PublicApiError ? err.message : "Could not load events.";
      setError(message);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Events</Text>
        <Text style={styles.subtitle}>
          Upcoming published shows · times in {VENUE_TIMEZONE_LABEL}
        </Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EventRow event={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load("refresh")}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            error ? (
              <StateMessage
                title="Couldn’t load events"
                body={error}
                actionLabel="Try again"
                onAction={() => void load("initial")}
              />
            ) : (
              <StateMessage
                title="No upcoming events yet"
                body="There are no published public events in the calendar right now. Pull to refresh, or check back soon."
                actionLabel="Refresh"
                onAction={() => void load("refresh")}
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  title: {
    fontFamily: "BebasNeue_400Regular",
    fontSize: 40,
    letterSpacing: 1,
    color: colors.text,
  },
  subtitle: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 14,
    color: colors.textMuted,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
