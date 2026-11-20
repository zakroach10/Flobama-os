import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { api, type Artist, type Recording, type Show } from "../../src/api";
import { formatWhen } from "../../src/theme";
import { Card, Detail, Display, ErrorText, Eyebrow, GoldButton, Muted, Title } from "../../src/ui";

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
    <Detail>
      <ErrorText message={error} />
      {artist ? (
        <>
          {artist.genre ? <Eyebrow>{artist.genre}</Eyebrow> : null}
          <Display>{artist.name}</Display>
          {artist.bio ? <Muted>{artist.bio}</Muted> : null}
          {artist.websiteUrl ? <GoldButton label="Website" onPress={() => void Linking.openURL(artist.websiteUrl!)} /> : null}
          {shows.length ? <Eyebrow>Upcoming</Eyebrow> : null}
          {shows.map((show) => (
            <Card key={show.id} onPress={() => router.push(`/show/${show.id}`)}>
              <Title>{show.title}</Title>
              <Muted>{formatWhen(show.startsAt)}</Muted>
            </Card>
          ))}
          {recordings.length ? <Eyebrow>Recordings</Eyebrow> : null}
          {recordings.map((recording) => (
            <Card key={recording.id} onPress={() => router.push(`/recording/${recording.id}`)}>
              <Title>{recording.title}</Title>
            </Card>
          ))}
        </>
      ) : null}
    </Detail>
  );
}
