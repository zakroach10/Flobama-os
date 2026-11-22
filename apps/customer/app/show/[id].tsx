import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { api, type Recording, type Show } from "../../src/api";
import { formatWhen } from "../../src/theme";
import { Card, Detail, Display, ErrorText, Eyebrow, Muted, Title } from "../../src/ui";

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
    <Detail>
      <ErrorText message={error} />
      {show ? (
        <>
          <Eyebrow>{formatWhen(show.startsAt)}</Eyebrow>
          <Display>{show.title}</Display>
          {show.locationLabel ? <Muted>{show.locationLabel}</Muted> : null}
          {show.coverCharge ? <Muted>Cover {show.coverCharge}</Muted> : null}
          {show.description ? <Muted>{show.description}</Muted> : null}
          {show.artists.length ? <Eyebrow>Artists</Eyebrow> : null}
          {show.artists.map((artist) => (
            <Card key={artist.id} onPress={() => router.push(`/artist/${artist.id}`)}>
              <Title>{artist.name}</Title>
              {artist.genre ? <Muted>{artist.genre}</Muted> : null}
            </Card>
          ))}
          {recordings.length ? <Eyebrow>Watch</Eyebrow> : null}
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
