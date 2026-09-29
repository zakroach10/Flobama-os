"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CameraCommandKind, PtzDirection, ZoomDirection } from "@/lib/cameras/types";

type CommandPayload =
  | { direction: PtzDirection; speed: number }
  | { direction: ZoomDirection; speed: number }
  | { presetId: string; label?: string }
  | { direction: "near" | "far" | "auto" }
  | Record<string, never>
  | undefined;

const DIRS: Array<
  | { key: "center"; label: string; aria: string }
  | { key: PtzDirection; label: string; aria: string }
> = [
  { key: "up_left", label: "↖", aria: "Pan up left" },
  { key: "up", label: "↑", aria: "Tilt up" },
  { key: "up_right", label: "↗", aria: "Pan up right" },
  { key: "left", label: "←", aria: "Pan left" },
  { key: "center", label: "·", aria: "Idle" },
  { key: "right", label: "→", aria: "Pan right" },
  { key: "down_left", label: "↙", aria: "Pan down left" },
  { key: "down", label: "↓", aria: "Tilt down" },
  { key: "down_right", label: "↘", aria: "Pan down right" },
];

export function CameraPtzPad({
  speed,
  speeds,
  presets,
  supportsZoom,
  supportsFocus,
  supportsPresetSave,
  disabled,
  onSpeedChange,
  onCommand,
  onStop,
  onRelease,
}: {
  speed: number;
  speeds: number[];
  presets: Array<{ id: string; label: string }>;
  supportsZoom: boolean;
  supportsFocus: boolean;
  supportsPresetSave: boolean;
  disabled?: boolean;
  onSpeedChange: (speed: number) => void;
  onCommand: (kind: CameraCommandKind, payload?: CommandPayload) => void | Promise<void>;
  onStop: () => void;
  onRelease: () => void | Promise<void>;
}) {
  const holding = useRef(false);

  function beginMove(direction: PtzDirection) {
    if (disabled) return;
    holding.current = true;
    void onCommand("ptz_move", { direction, speed });
  }

  function endMove() {
    if (!holding.current) {
      void onCommand("ptz_stop", {});
      return;
    }
    holding.current = false;
    onStop();
  }

  function beginZoom(direction: ZoomDirection) {
    if (disabled || !supportsZoom) return;
    holding.current = true;
    void onCommand("ptz_zoom", { direction, speed });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor="ptz-speed">Movement speed</Label>
          <select
            id="ptz-speed"
            className="flex h-10 min-w-[7rem] rounded-md border bg-background px-3 text-sm"
            value={speed}
            disabled={disabled}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
          >
            {speeds.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="destructive"
          className="min-h-12 min-w-[8rem] text-base font-semibold"
          disabled={disabled}
          onClick={() => {
            holding.current = false;
            onStop();
          }}
        >
          Stop
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
        <div className="grid grid-cols-3 gap-2" onContextMenu={(event) => event.preventDefault()}>
          {DIRS.map((dir) => {
            if (dir.key === "center") {
              return (
                <div
                  key={dir.key}
                  className="flex min-h-14 items-center justify-center rounded-md border border-dashed text-muted-foreground"
                >
                  PTZ
                </div>
              );
            }
            const direction = dir.key;
            return (
              <button
                key={direction}
                type="button"
                aria-label={dir.aria}
                disabled={disabled}
                className="min-h-14 touch-none rounded-md border bg-muted/40 text-xl font-semibold disabled:opacity-40"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  beginMove(direction);
                }}
                onPointerUp={endMove}
                onPointerCancel={endMove}
                onLostPointerCapture={endMove}
              >
                {dir.label}
              </button>
            );
          })}
        </div>

        {supportsZoom ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-label="Zoom in"
              disabled={disabled}
              className="min-h-14 min-w-16 touch-none rounded-md border bg-muted/40 text-lg font-semibold disabled:opacity-40"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                beginZoom("in");
              }}
              onPointerUp={endMove}
              onPointerCancel={endMove}
              onLostPointerCapture={endMove}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              disabled={disabled}
              className="min-h-14 min-w-16 touch-none rounded-md border bg-muted/40 text-lg font-semibold disabled:opacity-40"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                beginZoom("out");
              }}
              onPointerUp={endMove}
              onPointerCancel={endMove}
              onLostPointerCapture={endMove}
            >
              −
            </button>
          </div>
        ) : null}
      </div>

      {presets.length > 0 ? (
        <div className="space-y-2">
          <Label>Presets</Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => void onCommand("ptz_preset_recall", { presetId: preset.id })}
              >
                {preset.label}
              </Button>
            ))}
            {supportsPresetSave ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() =>
                  void onCommand("ptz_preset_save", {
                    presetId: presets[0]?.id ?? "1",
                    label: presets[0]?.label ?? "Preset 1",
                  })
                }
              >
                Save current
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {supportsFocus ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void onCommand("ptz_focus", { direction: "near" })}>
            Focus near
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void onCommand("ptz_focus", { direction: "far" })}>
            Focus far
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void onCommand("ptz_focus", { direction: "auto" })}>
            Auto focus
          </Button>
        </div>
      ) : null}

      <Button type="button" variant="ghost" size="sm" onClick={() => void onRelease()}>
        Release control
      </Button>
    </div>
  );
}
