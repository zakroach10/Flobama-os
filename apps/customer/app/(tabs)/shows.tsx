import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { api, type Recording, type Show } from "../../src/api";
import { formatWhen } from "../../src/theme";
import { BrandHeader, Card, ErrorText, Muted, SampleNote, Screen, SectionTitle, Title } from "../../src/ui";

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

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load().finally(() => setRefreshing(false));
      }}
    >
      <BrandHeader kicker="Schedule" />
      <SampleNote show={sample} />
      <ErrorText message={error} />
      <SectionTitle>Coming up</SectionTitle>
      {shows.length === 0 ? <Muted>No upcoming shows are published yet.</Muted> : null}
      {shows.map((show) => (
        <Card key={show.id} onPress={() => router.push(`/show/${show.id}`)}>
          <Title>{show.title}</Title>
          <Muted>
            {formatWhen(show.startsAt)}
            {show.coverCharge ? ` · Cover ${show.coverCharge}` : ""}
          </Muted>
          {show.artists.length ? <Muted>{show.artists.map((artist) => artist.name).join(", ")}</Muted> : null}
        </Card>
      ))}
      <SectionTitle>Past performances</SectionTitle>
      {recordings.length === 0 ? <Muted>Recorded shows show up here after staff publish them.</Muted> : null}
      {recordings.map((recording) => (
        <Card key={recording.id} onPress={() => router.push(`/recording/${recording.id}`)}>
          <Title>{recording.title}</Title>
          <Muted>
            {recording.artistName || recording.eventTitle || "FloBama"}
            {recording.recordedAt ? ` · ${formatWhen(recording.recordedAt)}` : ""}
          </Muted>
        </Card>
      ))}
    </Screen>
  );
}
