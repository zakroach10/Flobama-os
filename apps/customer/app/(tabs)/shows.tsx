import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api, type Recording, type Show } from "../../src/api";
import { colors, dayKey, fonts, formatClock, formatDayMarker, formatDayLabel, space, type as typeScale } from "../../src/theme";
import { Card, ErrorText, Eyebrow, Muted, Reveal, SampleNote, Screen, Title } from "../../src/ui";

function groupByDay(shows: Show[]) {
  const groups: { key: string; show: Show; items: Show[] }[] = [];
  for (const show of shows) {
    const key = dayKey(show.startsAt);
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) groups.push({ key, show, items: [show] });
    else last.items.push(show);
  }
  return groups;
}

export default function ShowsScreen() {
  const router = useRouter();
  const [shows, setShows] = useState<Show[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [sample, setSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [upcoming, past] = await Promise.all([api.shows(false), api.recordings()]);
      setShows(upcoming.shows);
      setRecordings(past.recordings);
      setSample(upcoming.sample);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load shows.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = groupByDay(shows);
  let revealIndex = 0;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load().finally(() => setRefreshing(false));
      }}
    >
      <SampleNote show={sample} />
      <ErrorText message={error} />
      <Eyebrow>Schedule</Eyebrow>
      {shows.length === 0 ? <Muted>No upcoming shows are published yet.</Muted> : null}
      {groups.map((group) => {
        const marker = formatDayMarker(group.show.startsAt);
        return (
          <View key={group.key} style={styles.day}>
            <View style={styles.marker}>
              <Text style={styles.weekday}>{marker.weekday}</Text>
              <Text style={styles.dayNum}>{marker.day}</Text>
              <Text style={styles.month}>{marker.month}</Text>
            </View>
            <View style={styles.dayShows}>
              {group.items.map((show) => {
                const index = revealIndex;
                revealIndex += 1;
                return (
                  <Reveal key={show.id} index={index}>
                    <Card onPress={() => router.push(`/show/${show.id}`)}>
                      <Text style={styles.time}>{formatClock(show.startsAt)}</Text>
                      <Title>{show.title}</Title>
                      {show.artists.length ? <Muted>{show.artists.map((artist) => artist.name).join(", ")}</Muted> : null}
                      {show.coverCharge ? <Muted>Cover {show.coverCharge}</Muted> : null}
                    </Card>
                  </Reveal>
                );
              })}
            </View>
          </View>
        );
      })}
      <Eyebrow>Past performances</Eyebrow>
      {recordings.length === 0 ? <Muted>Recorded shows show up here after staff publish them.</Muted> : null}
      {recordings.map((recording, index) => (
        <Reveal key={recording.id} index={index}>
          <Card onPress={() => router.push(`/recording/${recording.id}`)}>
            <Title>{recording.title}</Title>
            <Muted>
              {recording.artistName || recording.eventTitle || "FloBama"}
              {recording.recordedAt ? ` · ${formatDayLabel(recording.recordedAt)}` : ""}
            </Muted>
          </Card>
        </Reveal>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  marker: { width: 52, alignItems: "center", paddingTop: space.sm },
  weekday: { color: colors.gold, fontFamily: fonts.textStrong, fontSize: typeScale.label, letterSpacing: 0.6, textTransform: "uppercase" },
  dayNum: { color: colors.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  month: { color: colors.muted, fontFamily: fonts.text, fontSize: typeScale.label },
  dayShows: { flex: 1, gap: space.md },
  time: { color: colors.gold, fontFamily: fonts.textStrong, fontSize: typeScale.small },
});
