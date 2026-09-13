"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveEventAction } from "@/actions/records";
import { saveArtistAction } from "@/actions/records";
import { searchArtistsAction } from "@/actions/artists-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EVENT_STATUSES, EVENT_TYPES, EVENT_TYPE_LABELS, EVENT_STATUS_LABELS, EVENT_VISIBILITY_LABELS } from "@/lib/constants";
import type { EventFormInput, EventFormValues } from "@/lib/validation/schemas";

export type ArtistOption = { id: string; name: string; genre: string | null };

export function EventForm({
  defaultValues,
  artists,
  timeZone,
  eventId,
  isDuplicate = false,
}: {
  defaultValues: EventFormInput;
  artists: ArtistOption[];
  timeZone: string;
  eventId?: string;
  isDuplicate?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<EventFormValues>({
    title: defaultValues.title,
    eventType: defaultValues.eventType,
    startDate: defaultValues.startDate,
    startTime: defaultValues.startTime,
    endDate: defaultValues.endDate,
    endTime: defaultValues.endTime,
    locationLabel: defaultValues.locationLabel ?? null,
    publicDescription: defaultValues.publicDescription ?? null,
    internalNotes: defaultValues.internalNotes ?? null,
    status: defaultValues.status,
    visibility: defaultValues.visibility,
    featured: defaultValues.featured,
    isTicketed: defaultValues.isTicketed ?? false,
    ticketUrl: defaultValues.ticketUrl ?? null,
    coverLabel: defaultValues.coverLabel ?? null,
    artistIds: defaultValues.artistIds ?? [],
    timeZone,
    datesReviewed: defaultValues.datesReviewed,
    isDuplicateDraft: isDuplicate,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [artistQuery, setArtistQuery] = useState("");
  const [remoteArtists, setRemoteArtists] = useState<ArtistOption[]>(artists);
  const [addOpen, setAddOpen] = useState(false);

  const selected = useMemo(
    () => remoteArtists.filter((artist) => values.artistIds.includes(artist.id)),
    [remoteArtists, values.artistIds],
  );

  const visibleArtists = remoteArtists.filter((artist) =>
    artist.name.toLowerCase().includes(artistQuery.trim().toLowerCase()),
  );

  function update<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSearch(query: string) {
    setArtistQuery(query);
    const result = await searchArtistsAction(query);
    if (!result.error) {
      setRemoteArtists((current) => {
        const merged = [...current];
        for (const artist of result.artists) {
          if (!merged.some((row) => row.id === artist.id)) merged.push(artist);
        }
        return merged;
      });
    }
  }

  function toggleArtist(id: string) {
    update(
      "artistIds",
      values.artistIds.includes(id) ? values.artistIds.filter((item) => item !== id) : [...values.artistIds, id],
    );
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await saveEventAction(values, eventId);
      if (!result.ok) {
        setFormError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.push(`/events/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {isDuplicate ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This is a duplicate draft. Status is reset to draft. Confirm the start and end times before saving.
        </div>
      ) : null}

      <fieldset className="space-y-4" disabled={pending}>
        <legend className="text-base font-semibold">Basics</legend>
        <Field error={fieldErrors.title?.[0]}>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={values.title} onChange={(e) => update("title", e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field error={fieldErrors.eventType?.[0]}>
            <Label htmlFor="eventType">Event type</Label>
            <select
              id="eventType"
              className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={values.eventType}
              onChange={(e) => update("eventType", e.target.value as EventFormValues["eventType"])}
            >
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EVENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Label htmlFor="locationLabel">Location / stage</Label>
            <Input
              id="locationLabel"
              value={values.locationLabel ?? ""}
              onChange={(e) => update("locationLabel", e.target.value || null)}
              placeholder="Main room"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={pending}>
        <legend className="text-base font-semibold">Schedule</legend>
        <p className="text-sm text-muted-foreground">
          Times are interpreted in the venue timezone: <strong>{timeZone}</strong>. Overnight events should use the
          next calendar date for the end time. Invalid daylight-saving times are rejected.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field error={fieldErrors.startDate?.[0] ?? fieldErrors.startTime?.[0]}>
            <Label htmlFor="startDate">Start date</Label>
            <Input id="startDate" type="date" value={values.startDate} onChange={(e) => update("startDate", e.target.value)} required />
          </Field>
          <Field>
            <Label htmlFor="startTime">Start time ({timeZone})</Label>
            <Input id="startTime" type="time" value={values.startTime} onChange={(e) => update("startTime", e.target.value)} required />
          </Field>
          <Field error={fieldErrors.endDate?.[0] ?? fieldErrors.endTime?.[0]}>
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" type="date" value={values.endDate} onChange={(e) => update("endDate", e.target.value)} required />
          </Field>
          <Field>
            <Label htmlFor="endTime">End time ({timeZone})</Label>
            <Input id="endTime" type="time" value={values.endTime} onChange={(e) => update("endTime", e.target.value)} required />
          </Field>
        </div>
        {isDuplicate ? (
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <Checkbox
              checked={Boolean(values.datesReviewed)}
              onCheckedChange={(checked) => update("datesReviewed", checked === true)}
            />
            <span>I have reviewed the start and end date and time.</span>
          </label>
        ) : null}
        {fieldErrors.datesReviewed?.[0] ? <p className="text-sm text-destructive">{fieldErrors.datesReviewed[0]}</p> : null}
      </fieldset>

      <fieldset className="space-y-4" disabled={pending}>
        <legend className="text-base font-semibold">Artists</legend>
        <p className="text-sm text-muted-foreground">Optional. Search the artist directory. Attach one or more records.</p>
        <Input
          aria-label="Search artists"
          placeholder="Search artists"
          value={artistQuery}
          onChange={(e) => void onSearch(e.target.value)}
        />
        <div className="max-h-56 overflow-y-auto rounded-lg border bg-card">
          {visibleArtists.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No matching artists.</p>
          ) : (
            <ul>
              {visibleArtists.map((artist) => (
                <li key={artist.id} className="border-b last:border-b-0">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                    <Checkbox
                      checked={values.artistIds.includes(artist.id)}
                      onCheckedChange={() => toggleArtist(artist.id)}
                    />
                    <span>
                      {artist.name}
                      {artist.genre ? <span className="text-muted-foreground"> · {artist.genre}</span> : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selected.length > 0 ? (
          <p className="text-sm text-muted-foreground">Selected: {selected.map((artist) => artist.name).join(", ")}</p>
        ) : null}
        <Button type="button" variant="outline" onClick={() => setAddOpen(true)}>
          Add artist
        </Button>
      </fieldset>

      <fieldset className="space-y-4" disabled={pending}>
        <legend className="text-base font-semibold">Copy</legend>
        <Field>
          <Label htmlFor="publicDescription">Public description</Label>
          <Textarea
            id="publicDescription"
            className="min-h-28"
            value={values.publicDescription ?? ""}
            onChange={(e) => update("publicDescription", e.target.value || null)}
          />
        </Field>
        <Field>
          <Label htmlFor="internalNotes">Internal notes (staff-only)</Label>
          <Textarea
            id="internalNotes"
            className="min-h-24"
            value={values.internalNotes ?? ""}
            onChange={(e) => update("internalNotes", e.target.value || null)}
          />
          <p className="text-xs text-muted-foreground">Never shown on the public website, even if the event is published.</p>
        </Field>
      </fieldset>

      <fieldset className="space-y-4" disabled={pending}>
        <legend className="text-base font-semibold">Status</legend>
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Published + public events appear on the public API, website embed, and OBS overlay. Private or draft rows
          never do, and internal notes stay staff-only.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <Checkbox
              checked={values.isTicketed}
              onCheckedChange={(checked) => update("isTicketed", checked === true)}
            />
            Ticketed show (external link)
          </label>
          <Field error={fieldErrors.coverLabel?.[0]}>
            <Label htmlFor="coverLabel">Cover charge</Label>
            <Input
              id="coverLabel"
              value={values.coverLabel ?? ""}
              onChange={(e) => update("coverLabel", e.target.value || null)}
              placeholder="$5.00 or Free"
            />
          </Field>
        </div>
        <Field error={fieldErrors.ticketUrl?.[0]}>
          <Label htmlFor="ticketUrl">Ticket URL</Label>
          <Input
            id="ticketUrl"
            value={values.ticketUrl ?? ""}
            onChange={(e) => update("ticketUrl", e.target.value || null)}
            placeholder="https://"
          />
          <p className="text-xs text-muted-foreground">
            For FloBama Ticketing (tables, QR, door check-in), use the Ticketing tab on the saved event instead of an external URL.
          </p>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={values.status}
              onChange={(e) => update("status", e.target.value as EventFormValues["status"])}
            >
              {EVENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {EVENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Label htmlFor="visibility">Visibility</Label>
            <select
              id="visibility"
              className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={values.visibility}
              onChange={(e) => update("visibility", e.target.value as EventFormValues["visibility"])}
            >
              {Object.entries(EVENT_VISIBILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Checkbox checked={values.featured} onCheckedChange={(checked) => update("featured", checked === true)} />
          Featured
        </label>
      </fieldset>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
          {pending ? "Saving…" : eventId ? "Save event" : "Create event"}
        </Button>
        <Button type="button" className="w-full sm:w-auto" variant="outline" disabled={pending} onClick={() => router.back()}>
          Cancel
        </Button>
      </div>

      <AddArtistDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(artist) => {
          setRemoteArtists((current) => [artist, ...current.filter((row) => row.id !== artist.id)]);
          update("artistIds", [...values.artistIds, artist.id]);
        }}
      />
    </form>
  );
}

function Field({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-2">
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function AddArtistDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (artist: ArtistOption) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveArtistAction({ name, genre, bio: "", websiteUrl: "" });
      if (!result.ok || !result.id) {
        setError(result.message);
        return;
      }
      toast.success("Artist added");
      onCreated({ id: result.id, name, genre: genre || null });
      setName("");
      setGenre("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add artist</DialogTitle>
          <DialogDescription>Creates a directory record and attaches it to this event draft.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="new-artist-name">Name</Label>
            <Input id="new-artist-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-artist-genre">Genre</Label>
            <Input id="new-artist-genre" value={genre} onChange={(e) => setGenre(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="button" onClick={onSave} disabled={pending || !name.trim()}>
            {pending ? "Adding…" : "Save artist"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
