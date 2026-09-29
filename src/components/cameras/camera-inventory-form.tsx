"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteCameraInventoryAction, upsertCameraInventoryAction } from "@/actions/cameras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StaffCameraInventoryItem } from "@/lib/cameras/types";

export function CameraInventoryForm({
  inventory,
  canEdit,
}: {
  inventory: StaffCameraInventoryItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [sourceKey, setSourceKey] = useState("");
  const [protocol, setProtocol] = useState<"simulated" | "ndi_ptz" | "visca_udp" | "visca_tcp">("ndi_ptz");
  const [connectionTarget, setConnectionTarget] = useState("");
  const [isProgramOutput, setIsProgramOutput] = useState(false);

  if (!canEdit) return null;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Camera setup</h2>
        <p className="text-sm text-muted-foreground">
          Create each venue camera here. Use the exact NDI source name from Ecamm/NDI tools for NDI cameras.
          Simulated cameras give a labeled preview for testing. Program output is preview-only.
        </p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const key =
              sourceKey.trim() ||
              title
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "")
                .slice(0, 80);
            const result = await upsertCameraInventoryAction({
              title: title.trim(),
              sourceKey: key,
              protocol,
              connectionTarget: connectionTarget.trim() || null,
              isProgramOutput,
              supportsPtz: !isProgramOutput,
              supportsZoom: !isProgramOutput,
              supportsPresets: !isProgramOutput,
              supportsPresetSave: false,
              supportsFocus: false,
              enabled: true,
            });
            if (!result.ok) toast.error(result.message);
            else {
              toast.success(result.message);
              setTitle("");
              setSourceKey("");
              setConnectionTarget("");
              setIsProgramOutput(false);
              router.refresh();
            }
          });
        }}
      >
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="cam-title">Display name</Label>
          <Input
            id="cam-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Stage left PTZ"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cam-key">Source key</Label>
          <Input
            id="cam-key"
            value={sourceKey}
            onChange={(event) => setSourceKey(event.target.value)}
            placeholder="stage-left (optional)"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cam-protocol">Protocol</Label>
          <select
            id="cam-protocol"
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={protocol}
            onChange={(event) => setProtocol(event.target.value as typeof protocol)}
          >
            <option value="ndi_ptz">NDI (PTZ if supported)</option>
            <option value="visca_udp">VISCA over UDP</option>
            <option value="visca_tcp">VISCA over TCP</option>
            <option value="simulated">Simulated (test)</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="cam-target">
            {protocol.startsWith("visca") ? "Camera IP / host" : "NDI source name (exact)"}
          </Label>
          <Input
            id="cam-target"
            value={connectionTarget}
            onChange={(event) => setConnectionTarget(event.target.value)}
            placeholder={protocol.startsWith("visca") ? "192.168.1.50" : "CAM 1 (Studio)"}
            disabled={protocol === "simulated"}
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={isProgramOutput}
            onChange={(event) => setIsProgramOutput(event.target.checked)}
          />
          Ecamm / program output (preview only — never controls a camera)
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending || !title.trim()}>
            {pending ? "Saving…" : "Add camera"}
          </Button>
        </div>
      </form>

      {inventory.length > 0 ? (
        <ul className="space-y-2 border-t pt-4">
          {inventory.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.protocol}
                  {item.connectionTarget ? ` · ${item.connectionTarget}` : ""}
                  {item.isProgramOutput ? " · program output" : ""}
                  {!item.enabled ? " · disabled" : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`Delete “${item.title}”?`)) return;
                  startTransition(async () => {
                    const result = await deleteCameraInventoryAction({ id: item.id });
                    if (!result.ok) toast.error(result.message);
                    else {
                      toast.success(result.message);
                      router.refresh();
                    }
                  });
                }}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
