import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api, type LiveState, type Show, type Special } from "../../src/api";
import { LivePlayer } from "../../src/LivePlayer";
import { colors, fonts, formatClock, formatDayLabel, radii, space, type as typeScale } from "../../src/theme";
import { Card, ErrorText, Eyebrow, LiveMark, Muted, Reveal, SampleNote, Screen, Title } from "../../src/ui";

export default function LiveScreen() {
  const router = useRouter();
  const [live, setLive] = useState<LiveState | null>(null);
  const [upcoming, setUpcoming] = useState<Show[]>([]);
  const [specials, setSpecials] = useState<Special[]>([]);
  const [sample, setSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const home = await api.home();
      setLive(home.live);
      setUpcoming(home.upcoming);
      setSpecials(home.specials);
      setSample(home.sample);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reach FloBama.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const next = upcoming[0] ?? null;
  const later = upcoming.slice(1, 4);

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load().finally(() => setRefreshing(false));
      }}
    >
      <View style={styles.hero}>
        <LiveMark />
        <View style={styles.badgeRow}>
          <View style={[styles.badge, live?.live ? styles.live : styles.quiet]}>
            <Text style={styles.badgeText}>{live?.live ? "Live now" : "Offline"}</Text>
          </View>
          {live?.preview ? <Text style={styles.preview}>Preview</Text> : null}
        </View>
        {live?.live && live.playbackUrl ? (
          <LivePlayer uri={live.playbackUrl} />
        ) : (
          <View style={styles.darkStage}>
            <Text style={styles.stageTitle}>Stage is dark</Text>
            <Text style={styles.stageCopy}>{live?.message || "The room opens when the band walks on."}</Text>
          </View>
        )}
        {live?.live && live.message ? <Muted>{live.message}</Muted> : null}
      </View>
      <SampleNote show={sample} />
      <ErrorText message={error} />
      {next ? (
        <Reveal index={0}>
          <Card onPress={() => router.push(`/show/${next.id}`)}>
            <Eyebrow>Next up</Eyebrow>
            <Title>{next.title}</Title>
            <Muted>
              {formatDayLabel(next.startsAt)} · {formatClock(next.startsAt)}
              {next.locationLabel ? ` · ${next.locationLabel}` : ""}
            </Muted>
          </Card>
        </Reveal>
      ) : null}
      {later.map((show, index) => (
        <Reveal key={show.id} index={index + 1}>
          <Card onPress={() => router.push(`/show/${show.id}`)}>
            <Title>{show.title}</Title>
            <Muted>
              {formatDayLabel(show.startsAt)} · {formatClock(show.startsAt)}
            </Muted>
          </Card>
        </Reveal>
      ))}
      {specials.length ? (
        <View style={styles.specials}>
          <Eyebrow>Specials</Eyebrow>
          {specials.map((special) => (
            <View key={special.id} style={styles.specialRow}>
              <Text style={styles.specialName}>{special.title}</Text>
              {special.priceLabel ? <Text style={styles.specialPrice}>{special.priceLabel}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.raised,
    borderRadius: radii.lg,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  badge: { borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 5 },
  live: { backgroundColor: colors.red },
  quiet: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  badgeText: { color: colors.text, fontFamily: fonts.textStrong, fontSize: typeScale.small },
  preview: { color: colors.gold, fontFamily: fonts.textMedium, fontSize: typeScale.small },
  darkStage: {
    minHeight: 160,
    borderRadius: radii.md,
    backgroundColor: "#070605",
    justifyContent: "flex-end",
    padding: space.lg,
    gap: space.xs,
  },
  stageTitle: { color: colors.text, fontFamily: fonts.displaySoft, fontSize: typeScale.card },
  stageCopy: { color: colors.muted, fontFamily: fonts.text, fontSize: typeScale.small, lineHeight: 20 },
  specials: { gap: space.sm },
  specialRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md, alignItems: "baseline" },
  specialName: { color: colors.text, fontFamily: fonts.textMedium, fontSize: typeScale.body, flex: 1 },
  specialPrice: { color: colors.gold, fontFamily: fonts.textStrong, fontSize: typeScale.body },
});
