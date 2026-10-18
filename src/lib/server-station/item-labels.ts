export const SERVER_STATION_KIND_LABEL: Record<string, string> = {
  food_special: "Food deal",
  drink_special: "Drink deal",
  birthday: "Celebration",
  celebration: "Celebration",
  message: "Message",
  upload: "Photo",
};

export function serverStationKindLabel(kind: string) {
  return SERVER_STATION_KIND_LABEL[kind] ?? "Slide";
}

export function serverStationPlacement(item: {
  status: string;
  show_now: boolean;
  playlist_item_id: string | null;
  override_starts_at: string | null;
}) {
  if (item.status === "pending_approval") return "Needs manager approval";
  if (item.status === "expired" || item.status === "removed") return "Still on the wall — remove it";
  if (item.status === "queued") return "Waiting — the show is protected";
  if (item.override_starts_at && Date.parse(item.override_starts_at) > Date.now()) {
    return "Plays after the current ad";
  }
  if (item.show_now) return "Showing on the wall now";
  if (item.playlist_item_id) return "In the rotation";
  return "On the wall";
}
