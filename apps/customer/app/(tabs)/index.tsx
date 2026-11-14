import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api, type LiveState, type Show, type Special } from "../../src/api";
import { LivePlayer } from "../../src/LivePlayer";
import { colors, formatWhen } from "../../src/theme";
import { BrandHeader, Card, ErrorText, Muted, SampleNote, Screen, Title } from "../../src/ui";

export default function LiveScreen() {
  const router = useRouter();
  const [live, setLive] = useState<LiveState | null>(null);
  const [tonight, setTonight] = useState<Show | null>(null);
  const [specials, setSpecials] = useState<Special[]>([]);
  const [sample, setSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const home = await api.home();
      setLive(home.live);
      setTonight(home.tonight);
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

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load().finally(() => setRefreshing(false));
      }}
    >
      <BrandHeader kicker="Downtown Florence" />
      <SampleNote show={sample} />
      <ErrorText message={error} />
      <View style={styles.badgeRow}>
        <View style={[styles.badge, live?.live ? styles.live : styles.offline]}>
          <Text style={styles.badgeText}>{live?.live ? "Live now" : "Offline"}</Text>
        </View>
        {live?.preview ? <Text style={styles.preview}>Preview</Text> : null}
      </View>
      {live?.live && live.playbackUrl ? (
        <LivePlayer uri={live.playbackUrl} />
      ) : (
        <Card>
          <Title>Stage is dark</Title>
          <Muted>{live?.message || "Pull to refresh when the band walks on."}</Muted>
        </Card>
      )}
      {live?.message && live.live ? <Muted>{live.message}</Muted> : null}
      {tonight ? (
        <Card onPress={() => router.push(`/show/${tonight.id}`)}>
          <Text style={styles.kicker}>Next up</Text>
          <Title>{tonight.title}</Title>
          <Muted>
            {formatWhen(tonight.startsAt)}
            {tonight.locationLabel ? ` · ${tonight.locationLabel}` : ""}
          </Muted>
          {tonight.artists.length ? <Muted>{tonight.artists.map((artist) => artist.name).join(", ")}</Muted> : null}
        </Card>
      ) : null}
      {specials.length ? (
        <Card>
          <Text style={styles.kicker}>Tonight&apos;s specials</Text>
          {specials.map((special) => (
            <Text key={special.id} style={styles.special}>
              {special.title}
              {special.priceLabel ? `  ${special.priceLabel}` : ""}
            </Text>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  live: { backgroundColor: colors.red },
  offline: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  badgeText: { color: colors.text, fontWeight: "800", letterSpacing: 0.4 },
  preview: { color: colors.gold, fontWeight: "700" },
  kicker: { color: colors.gold, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  special: { color: colors.text, fontSize: 16 },
});
