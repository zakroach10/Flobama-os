import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { api, type Artist, type Recording, type Show } from "../../src/api";
import { formatWhen } from "../../src/theme";
import { Card, ErrorText, GoldButton, Muted, Screen, SectionTitle, Title } from "../../src/ui";

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api
      .artist(id)
      .then((result) => {
        setArtist(result.artist);
        setShows(result.shows);
        setRecordings(result.recordings);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Artist not found."));
  }, [id]);

  return (
    <Screen>
      <ErrorText message={error} />
      {artist ? (
        <>
          <Title>{artist.name}</Title>
          {artist.genre ? <Muted>{artist.genre}</Muted> : null}
          {artist.bio ? <Muted>{artist.bio}</Muted> : null}
          {artist.websiteUrl ? <GoldButton label="Website" onPress={() => void Linking.openURL(artist.websiteUrl!)} /> : null}
          {shows.length ? <SectionTitle>Upcoming</SectionTitle> : null}
          {shows.map((show) => (
            <Card key={show.id} onPress={() => router.push(`/show/${show.id}`)}>
              <Title>{show.title}</Title>
              <Muted>{formatWhen(show.startsAt)}</Muted>
            </Card>
          ))}
          {recordings.length ? <SectionTitle>Recordings</SectionTitle> : null}
          {recordings.map((recording) => (
            <Card key={recording.id} onPress={() => router.push(`/recording/${recording.id}`)}>
              <Title>{recording.title}</Title>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
