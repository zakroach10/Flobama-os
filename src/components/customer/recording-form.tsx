"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveRecordingAction, saveRecordingAction } from "@/actions/customer-app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Recording = {
  id: string;
  title: string;
  description: string | null;
  playback_id: string | null;
  event_id: string | null;
  artist_id: string | null;
  published: boolean;
};

export function RecordingForm({
  recording,
  canEdit,
  events,
  artists,
}: {
  recording?: Recording;
  canEdit: boolean;
  events: { id: string; title: string }[];
  artists: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(recording?.title ?? "");
  const [description, setDescription] = useState(recording?.description ?? "");
  const [playbackId, setPlaybackId] = useState(recording?.playback_id ?? "");
  const [eventId, setEventId] = useState(recording?.event_id ?? "");
  const [artistId, setArtistId] = useState(recording?.artist_id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [published, setPublished] = useState(recording?.published ?? false);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    startTransition(async () => {
      const result = await saveRecordingAction(
        { title, description, playbackId, eventId, artistId, date, time, published },
        recording?.id,
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (!recording) {
        setTitle("");
        setPlaybackId("");
        setDescription("");
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`rec-title-${recording?.id ?? "new"}`}>Title</Label>
        <Input id={`rec-title-${recording?.id ?? "new"}`} value={title} onChange={(event) => setTitle(event.target.value)} required disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`rec-play-${recording?.id ?? "new"}`}>Mux playback ID</Label>
        <Input id={`rec-play-${recording?.id ?? "new"}`} value={playbackId} onChange={(event) => setPlaybackId(event.target.value)} required disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`rec-desc-${recording?.id ?? "new"}`}>Description</Label>
        <Textarea id={`rec-desc-${recording?.id ?? "new"}`} value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`rec-event-${recording?.id ?? "new"}`}>Show</Label>
        <select id={`rec-event-${recording?.id ?? "new"}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={eventId} onChange={(event) => setEventId(event.target.value)} disabled={!canEdit || pending}>
          <option value="">None</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>{event.title}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`rec-artist-${recording?.id ?? "new"}`}>Artist</Label>
        <select id={`rec-artist-${recording?.id ?? "new"}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={artistId} onChange={(event) => setArtistId(event.target.value)} disabled={!canEdit || pending}>
          <option value="">None</option>
          {artists.map((artist) => (
            <option key={artist.id} value={artist.id}>{artist.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`rec-date-${recording?.id ?? "new"}`}>Recorded date</Label>
        <Input id={`rec-date-${recording?.id ?? "new"}`} type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`rec-time-${recording?.id ?? "new"}`}>Recorded time</Label>
        <Input id={`rec-time-${recording?.id ?? "new"}`} type="time" value={time} onChange={(event) => setTime(event.target.value)} disabled={!canEdit || pending} />
      </div>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} disabled={!canEdit || pending} />
        Published in the customer app
      </label>
      {canEdit ? (
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={pending}>{recording ? "Save" : "Add recording"}</Button>
          {recording ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await archiveRecordingAction(recording.id);
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success(result.message);
                    router.refresh();
                  }
                });
              }}
            >
              Archive
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
