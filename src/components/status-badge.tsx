import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, type EventStatus, type EventType } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5",
        status === "published" && "border-emerald-700/30 bg-emerald-50 text-emerald-800",
        status === "draft" && "border-amber-700/30 bg-amber-50 text-amber-900",
        status === "cancelled" && "border-stone-400 bg-stone-100 text-stone-700",
      )}
    >
      {EVENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function TypeBadge({ type }: { type: EventType }) {
  return (
    <Badge variant="secondary" className="rounded-md">
      {EVENT_TYPE_LABELS[type]}
    </Badge>
  );
}

export function VisibilityNote({ visibility }: { visibility: "public" | "private" }) {
  if (visibility === "public") return null;
  return (
    <Badge variant="outline" className="rounded-md">
      Private
    </Badge>
  );
}
