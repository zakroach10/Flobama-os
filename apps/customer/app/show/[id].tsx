import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { api, type Recording, type Show } from "../../src/api";
import { formatWhen } from "../../src/theme";
import { Card, ErrorText, Muted, Screen, SectionTitle, Title } from "../../src/ui";

export default function ShowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [show, setShow] = useState<Show | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api
      .show(id)
      .then((result) => {
        setShow(result.show);
        setRecordings(result.recordings);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Show not found."));
  }, [id]);

  return (
    <Screen>
      <ErrorText message={error} />
      {show ? (
        <>
          <Title>{show.title}</Title>
          <Muted>
            {formatWhen(show.startsAt)}
            {show.locationLabel ? ` · ${show.locationLabel}` : ""}
          </Muted>
          {show.coverCharge ? <Muted>Cover {show.coverCharge}</Muted> : null}
          {show.description ? <Muted>{show.description}</Muted> : null}
          {show.artists.length ? <SectionTitle>Artists</SectionTitle> : null}
          {show.artists.map((artist) => (
            <Card key={artist.id} onPress={() => router.push(`/artist/${artist.id}`)}>
              <Title>{artist.name}</Title>
              {artist.genre ? <Muted>{artist.genre}</Muted> : null}
            </Card>
          ))}
          {recordings.length ? <SectionTitle>Watch</SectionTitle> : null}
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
