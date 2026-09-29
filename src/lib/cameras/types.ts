export const CAMERA_PROTOCOLS = ["simulated", "ndi_ptz", "visca_udp", "visca_tcp", "unknown"] as const;
export type CameraProtocol = (typeof CAMERA_PROTOCOLS)[number];

export const CAMERA_COMMAND_KINDS = [
  "ptz_move",
  "ptz_stop",
  "ptz_zoom",
  "ptz_preset_recall",
  "ptz_preset_save",
  "ptz_focus",
] as const;
export type CameraCommandKind = (typeof CAMERA_COMMAND_KINDS)[number];

export const PTZ_DIRECTIONS = ["up", "down", "left", "right", "up_left", "up_right", "down_left", "down_right"] as const;
export type PtzDirection = (typeof PTZ_DIRECTIONS)[number];

export const ZOOM_DIRECTIONS = ["in", "out"] as const;
export type ZoomDirection = (typeof ZOOM_DIRECTIONS)[number];

export type CameraCapabilities = {
  ptz: boolean;
  zoom: boolean;
  presets: boolean;
  presetSave: boolean;
  focus: boolean;
  preview: boolean;
  speeds: number[];
  presetsList: Array<{ id: string; label: string }>;
};

export const CAMERA_LINK_STATUSES = [
  "unknown",
  "simulated",
  "ndi_pending",
  "ndi_live",
  "visca_pending",
  "visca_live",
  "offline",
  "error",
] as const;
export type CameraLinkStatus = (typeof CAMERA_LINK_STATUSES)[number];

export type StaffCameraSource = {
  id: string;
  sourceKey: string;
  title: string;
  protocol: CameraProtocol;
  isSimulated: boolean;
  isProgramOutput: boolean;
  supportsPtz: boolean;
  supportsZoom: boolean;
  supportsPresets: boolean;
  supportsPresetSave: boolean;
  supportsFocus: boolean;
  online: boolean;
  lastError: string | null;
  connectionTarget: string | null;
  connectionPort: number | null;
  linkStatus: CameraLinkStatus;
  inventoryId: string | null;
  capabilities: CameraCapabilities;
};

export type StaffCameraInventoryItem = {
  id: string;
  sourceKey: string;
  title: string;
  protocol: CameraProtocol;
  connectionTarget: string | null;
  connectionPort: number | null;
  isProgramOutput: boolean;
  supportsPtz: boolean;
  supportsZoom: boolean;
  supportsPresets: boolean;
  supportsPresetSave: boolean;
  supportsFocus: boolean;
  enabled: boolean;
  notes: string | null;
  sortOrder: number;
};

export type StaffCameraDevice = {
  id: string;
  label: string;
  lastSeenAt: string | null;
  connectorVersion: string | null;
  hostname: string | null;
  remoteControlEnabled: boolean;
  revokedAt: string | null;
  online: boolean;
  statusDetail?: string | null;
};

export type ConnectorReportedCamera = {
  sourceKey: string;
  title: string;
  protocol: CameraProtocol;
  isSimulated?: boolean;
  isProgramOutput?: boolean;
  supportsPtz?: boolean;
  supportsZoom?: boolean;
  supportsPresets?: boolean;
  supportsPresetSave?: boolean;
  supportsFocus?: boolean;
  online?: boolean;
  lastError?: string | null;
  connectionTarget?: string | null;
  connectionPort?: number | null;
  linkStatus?: CameraLinkStatus;
  inventoryId?: string | null;
  capabilities?: Partial<CameraCapabilities>;
  sortOrder?: number;
};

export type DesiredCameraInventory = {
  id: string;
  sourceKey: string;
  title: string;
  protocol: CameraProtocol;
  connectionTarget: string | null;
  connectionPort: number | null;
  isProgramOutput: boolean;
  supportsPtz: boolean;
  supportsZoom: boolean;
  supportsPresets: boolean;
  supportsPresetSave: boolean;
  supportsFocus: boolean;
  enabled: boolean;
  sortOrder: number;
};

export const CAMERA_CONNECTOR_SQL = "supabase/migrations/20260929000018_camera_connector.sql";
export const CAMERA_CONNECTOR_STALE_MS = 8_000;
export const CAMERA_COMMAND_TTL_MS = 2_500;
export const CAMERA_LEASE_TTL_MS = 20_000;
export const CAMERA_PAIRING_TTL_MS = 10 * 60_000;
export const CAMERA_PREVIEW_TTL_MS = 5 * 60_000;
export const CAMERA_MOVE_WATCHDOG_MS = 1_200;
