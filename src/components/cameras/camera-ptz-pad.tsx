"use client";

import { useRef, type PointerEventHandler } from "react";
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
  const activePointer = useRef<number | null>(null);

  function beginMove(direction: PtzDirection) {
    if (disabled) return;
    holding.current = true;
    void onCommand("ptz_move", { direction, speed });
  }

  function endMove() {
    if (!holding.current) return;
    holding.current = false;
    activePointer.current = null;
    onStop();
  }

  function beginZoom(direction: ZoomDirection) {
    if (disabled || !supportsZoom) return;
    holding.current = true;
    void onCommand("ptz_zoom", { direction, speed });
  }

  function bindHold(
    begin: () => void,
  ): {
    onPointerDown: PointerEventHandler<HTMLButtonElement>;
    onPointerUp: PointerEventHandler<HTMLButtonElement>;
    onPointerCancel: PointerEventHandler<HTMLButtonElement>;
    onPointerLeave: PointerEventHandler<HTMLButtonElement>;
  } {
    return {
      onPointerDown: (event) => {
        if (disabled) return;
        // iOS Safari: prevent synthetic mouse events + scrolling while holding.
        event.preventDefault();
        activePointer.current = event.pointerId;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* some WebKits throw if capture is unsupported mid-gesture */
        }
        begin();
      },
      onPointerUp: (event) => {
        if (activePointer.current != null && event.pointerId !== activePointer.current) return;
        endMove();
      },
      onPointerCancel: (event) => {
        if (activePointer.current != null && event.pointerId !== activePointer.current) return;
        endMove();
      },
      // Do NOT use onLostPointerCapture — iOS fires it immediately after
      // setPointerCapture and would stop the move before it starts.
      onPointerLeave: (event) => {
        // Only end if we never captured (desktop mouse leave without capture).
        if (activePointer.current == null) endMove();
        else if (event.pointerType === "mouse" && !event.buttons) endMove();
      },
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor="ptz-speed">Movement speed</Label>
          <select
            id="ptz-speed"
            className="flex h-11 min-w-[7rem] rounded-md border bg-background px-3 text-base sm:h-10 sm:text-sm"
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
            activePointer.current = null;
            onStop();
          }}
        >
          Stop
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:gap-4">
        <div
          className="grid grid-cols-3 gap-2 select-none"
          onContextMenu={(event) => event.preventDefault()}
          style={{ touchAction: "none" }}
        >
          {DIRS.map((dir) => {
            if (dir.key === "center") {
              return (
                <div
                  key={dir.key}
                  className="flex min-h-14 items-center justify-center rounded-md border border-dashed text-muted-foreground sm:min-h-14"
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
                className="min-h-14 touch-none rounded-md border bg-muted/40 text-xl font-semibold disabled:opacity-40 active:bg-muted"
                style={{ touchAction: "none", WebkitUserSelect: "none" }}
                {...bindHold(() => beginMove(direction))}
              >
                {dir.label}
              </button>
            );
          })}
        </div>

        {supportsZoom ? (
          <div className="flex flex-col gap-2" style={{ touchAction: "none" }}>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={disabled}
              className="min-h-14 min-w-16 touch-none rounded-md border bg-muted/40 text-lg font-semibold disabled:opacity-40 active:bg-muted"
              style={{ touchAction: "none", WebkitUserSelect: "none" }}
              {...bindHold(() => beginZoom("in"))}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              disabled={disabled}
              className="min-h-14 min-w-16 touch-none rounded-md border bg-muted/40 text-lg font-semibold disabled:opacity-40 active:bg-muted"
              style={{ touchAction: "none", WebkitUserSelect: "none" }}
              {...bindHold(() => beginZoom("out"))}
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
                className="min-h-11"
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
                className="min-h-11"
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={() => void onCommand("ptz_focus", { direction: "near" })}
          >
            Focus near
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={() => void onCommand("ptz_focus", { direction: "far" })}
          >
            Focus far
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={() => void onCommand("ptz_focus", { direction: "auto" })}
          >
            Auto focus
          </Button>
        </div>
      ) : null}

      <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => void onRelease()}>
        Release control
      </Button>
    </div>
  );
}
