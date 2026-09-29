import type { Json } from "@/lib/database.types";
import type { CameraCapabilities, CameraProtocol, ConnectorReportedCamera, StaffCameraSource } from "@/lib/cameras/types";
import { CAMERA_PROTOCOLS } from "@/lib/cameras/types";

const DEFAULT_SPEEDS = [1, 2, 4, 8, 12, 16];

export function defaultCapabilities(partial?: Partial<CameraCapabilities>): CameraCapabilities {
  return {
    ptz: partial?.ptz ?? false,
    zoom: partial?.zoom ?? false,
    presets: partial?.presets ?? false,
    presetSave: partial?.presetSave ?? false,
    focus: partial?.focus ?? false,
    preview: partial?.preview ?? true,
    speeds: partial?.speeds?.length ? partial.speeds : DEFAULT_SPEEDS,
    presetsList: partial?.presetsList ?? [],
  };
}

function asProtocol(value: string | null | undefined): CameraProtocol {
  if (value && (CAMERA_PROTOCOLS as readonly string[]).includes(value)) {
    return value as CameraProtocol;
  }
  return "unknown";
}

function parseCapabilities(value: Json | null | undefined, row: {
  supports_ptz: boolean;
  supports_zoom: boolean;
  supports_presets: boolean;
  supports_preset_save: boolean;
  supports_focus: boolean;
}): CameraCapabilities {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const speeds = Array.isArray(raw.speeds)
    ? raw.speeds.filter((n): n is number => typeof n === "number" && Number.isFinite(n)).map((n) => Math.round(n))
    : DEFAULT_SPEEDS;
  const presetsList = Array.isArray(raw.presetsList)
    ? raw.presetsList
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id.trim() : "";
          const label =
            typeof (item as { label?: unknown }).label === "string"
              ? (item as { label: string }).label.trim()
              : "";
          if (!id || !label) return null;
          return { id: id.slice(0, 64), label: label.slice(0, 80) };
        })
        .filter((item): item is { id: string; label: string } => Boolean(item))
    : [];

  return defaultCapabilities({
    ptz: Boolean(raw.ptz ?? row.supports_ptz),
    zoom: Boolean(raw.zoom ?? row.supports_zoom),
    presets: Boolean(raw.presets ?? row.supports_presets),
    presetSave: Boolean(raw.presetSave ?? row.supports_preset_save),
    focus: Boolean(raw.focus ?? row.supports_focus),
    preview: raw.preview === false ? false : true,
    speeds: speeds.length ? speeds : DEFAULT_SPEEDS,
    presetsList,
  });
}

export type CameraSourceRow = {
  id: string;
  source_key: string;
  title: string;
  protocol: string;
  is_simulated: boolean;
  is_program_output: boolean;
  supports_ptz: boolean;
  supports_zoom: boolean;
  supports_presets: boolean;
  supports_preset_save: boolean;
  supports_focus: boolean;
  online: boolean;
  last_error: string | null;
  capabilities: Json;
};

export function toStaffCameraSource(row: CameraSourceRow): StaffCameraSource {
  const capabilities = parseCapabilities(row.capabilities, row);
  return {
    id: row.id,
    sourceKey: row.source_key,
    title: row.title,
    protocol: asProtocol(row.protocol),
    isSimulated: row.is_simulated,
    isProgramOutput: row.is_program_output,
    supportsPtz: capabilities.ptz,
    supportsZoom: capabilities.zoom,
    supportsPresets: capabilities.presets,
    supportsPresetSave: capabilities.presetSave,
    supportsFocus: capabilities.focus,
    online: row.online,
    lastError: row.last_error,
    capabilities,
  };
}

export function normalizeReportedCamera(input: ConnectorReportedCamera, index: number) {
  const caps = defaultCapabilities({
    ptz: input.supportsPtz ?? input.capabilities?.ptz ?? false,
    zoom: input.supportsZoom ?? input.capabilities?.zoom ?? false,
    presets: input.supportsPresets ?? input.capabilities?.presets ?? false,
    presetSave: input.supportsPresetSave ?? input.capabilities?.presetSave ?? false,
    focus: input.supportsFocus ?? input.capabilities?.focus ?? false,
    preview: input.capabilities?.preview ?? true,
    speeds: input.capabilities?.speeds,
    presetsList: input.capabilities?.presetsList,
  });
  const protocol = asProtocol(input.protocol);
  const isProgramOutput = Boolean(input.isProgramOutput);
  return {
    source_key: input.sourceKey.trim().slice(0, 200),
    title: input.title.trim().slice(0, 160),
    protocol,
    is_simulated: Boolean(input.isSimulated) || protocol === "simulated",
    is_program_output: isProgramOutput,
    supports_ptz: isProgramOutput ? false : caps.ptz,
    supports_zoom: isProgramOutput ? false : caps.zoom,
    supports_presets: isProgramOutput ? false : caps.presets,
    supports_preset_save: isProgramOutput ? false : caps.presetSave,
    supports_focus: isProgramOutput ? false : caps.focus,
    online: input.online !== false,
    last_error: input.lastError?.trim().slice(0, 500) || null,
    sort_order: typeof input.sortOrder === "number" ? input.sortOrder : index,
    capabilities: caps as unknown as Json,
  };
}
