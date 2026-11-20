import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { api, type Recording } from "../../src/api";
import { LivePlayer } from "../../src/LivePlayer";
import { formatWhen } from "../../src/theme";
import { Detail, Display, ErrorText, Muted } from "../../src/ui";

export default function RecordingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api
      .recording(id)
      .then((result) => setRecording(result.recording))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Recording not found."));
  }, [id]);

  return (
    <Detail>
      <ErrorText message={error} />
      {recording ? (
        <>
          <Display>{recording.title}</Display>
          <Muted>
            {[
              recording.artistName,
              recording.eventTitle && recording.eventTitle !== recording.artistName ? recording.eventTitle : null,
              recording.recordedAt ? formatWhen(recording.recordedAt) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Muted>
          {recording.description ? <Muted>{recording.description}</Muted> : null}
          <LivePlayer uri={recording.playbackUrl} />
        </>
      ) : null}
    </Detail>
  );
}
