import { z } from "zod";
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  EVENT_VISIBILITIES,
  MENU_SPECIAL_CATEGORIES,
  SCREEN_TAKEOVER_MAX_MINUTES,
  SCREEN_TRANSITIONS,
  SCREEN_WALL_MODES,
  STAFF_ROLES,
} from "@/lib/constants";
import { STAFF_MENU_IDS } from "@/lib/auth/menus";
import { parseVenueLocalDateTime } from "@/lib/timezone";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null));

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    eventType: z.enum(EVENT_TYPES),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required."),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time is required."),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time is required."),
    locationLabel: optionalText(160),
    publicDescription: optionalText(8000),
    internalNotes: optionalText(8000),
    status: z.enum(EVENT_STATUSES),
    visibility: z.enum(EVENT_VISIBILITIES),
    featured: z.boolean(),
    isTicketed: z.boolean().default(false),
    ticketUrl: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal(""))
      .transform((value) => (value ? value : null))
      .refine(
        (value) => value === null || /^https?:\/\//i.test(value),
        "Ticket link must start with http:// or https://.",
      ),
    coverLabel: optionalText(40),
    artistIds: z.array(z.string().uuid()).default([]),
    datesReviewed: z.boolean().optional(),
    isDuplicateDraft: z.boolean().optional(),
    timeZone: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.isDuplicateDraft && value.datesReviewed !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["datesReviewed"],
        message: "Review the start and end times before saving a duplicated event.",
      });
    }

    const start = parseVenueLocalDateTime(value.startDate, value.startTime, value.timeZone);
    const end = parseVenueLocalDateTime(value.endDate, value.endTime, value.timeZone);

    if (!start.ok) {
      ctx.addIssue({ code: "custom", path: ["startTime"], message: start.message });
    }
    if (!end.ok) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: end.message });
    }
    if (start.ok && end.ok && end.dateTime <= start.dateTime) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End must be after start. Overnight events should use the next calendar date.",
      });
    }
  });

export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormValues = z.output<typeof eventFormSchema>;

export const artistFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  genre: optionalText(80),
  bio: optionalText(4000),
  websiteUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null))
    .refine(
      (value) => value === null || /^https?:\/\//i.test(value),
      "Website must start with http:// or https://.",
    ),
});

export type ArtistFormValues = z.output<typeof artistFormSchema>;

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required.").max(120),
});

export const venueSettingsSchema = z.object({
  name: z.string().trim().min(1, "Venue name is required.").max(160),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
  next: z.string().optional(),
});

export const passwordResetRequestSchema = z.object({
  email: z.email("Enter a valid email."),
});

export const createStaffSchema = z.object({
  email: z.email("Enter a valid email."),
  displayName: z.string().trim().min(1, "Display name is required.").max(120),
  role: z.enum(STAFF_ROLES),
  password: z.string().min(8, "Use at least 8 characters."),
  menus: z.array(z.enum(STAFF_MENU_IDS)).max(STAFF_MENU_IDS.length),
});

export type CreateStaffValues = z.output<typeof createStaffSchema>;

export const createComputerControlSchema = z.object({
  email: z.email("Enter a valid email."),
  displayName: z.string().trim().min(1, "Display name is required.").max(120),
  password: z.string().min(8, "Use at least 8 characters."),
});

export const updateStaffRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(STAFF_ROLES),
  menus: z.array(z.enum(STAFF_MENU_IDS)).max(STAFF_MENU_IDS.length),
});

export const removeStaffSchema = z.object({
  userId: z.string().uuid(),
});

export const passwordUpdateSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const optionalScene = z
  .string()
  .trim()
  .max(200)
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : null));

export const screenWallStateSchema = z.object({
  mode: z.enum(SCREEN_WALL_MODES),
  adsSceneName: optionalScene,
  bandSceneName: optionalScene,
  manualSceneName: optionalScene,
});

export const screenAdMetaSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(160),
    durationSeconds: z.number().int().min(1).max(600).nullable(),
    transition: z.enum(SCREEN_TRANSITIONS),
    enabled: z.boolean().default(true),
    mediaKind: z.enum(["image", "video", "week_events"]).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.mediaKind === "image" || value.mediaKind === "week_events") && value.durationSeconds == null) {
      ctx.addIssue({
        code: "custom",
        path: ["durationSeconds"],
        message: value.mediaKind === "week_events" ? "This week needs a hold time." : "Images need a hold time.",
      });
    }
  });

export const updateScreenAdSchema = screenAdMetaSchema.extend({
  id: z.string().uuid(),
});

export const createScreenAdRecordSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(160),
  durationSeconds: z.number().int().min(1).max(600).nullable(),
  transition: z.enum(SCREEN_TRANSITIONS),
  enabled: z.boolean().default(true),
  mediaKind: z.enum(["image", "video"]),
  storagePath: z.string().trim().min(1).max(500),
  publicUrl: z.string().trim().min(8).max(800),
  sortOrder: z.number().int().min(0),
  playlistId: z.string().uuid().nullable().optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  mediaType: z.string().trim().min(1).max(120).optional(),
});

export const reorderScreenAdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export const createScreenPlaylistSchema = z.object({
  name: z.string().trim().min(1, "Playlist name is required.").max(120),
  activate: z.boolean().default(false),
});

export const renameScreenPlaylistSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Playlist name is required.").max(120),
});

export const activateScreenPlaylistSchema = z.object({
  id: z.string().uuid(),
});

export const reorderPlaylistItemsSchema = z.object({
  playlistId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1),
});

export const updatePlaylistItemSchema = z.object({
  id: z.string().uuid(),
  durationSeconds: z.number().int().min(1).max(600).nullable(),
  transition: z.enum(SCREEN_TRANSITIONS),
  enabled: z.boolean(),
});

export const addPlaylistMediaItemSchema = z.object({
  playlistId: z.string().uuid(),
  mediaId: z.string().uuid(),
});

export const addPlaylistSpecialItemSchema = z.object({
  playlistId: z.string().uuid(),
  specialId: z.string().uuid(),
});

export const addPlaylistWeekEventsSchema = z.object({
  playlistId: z.string().uuid(),
});

export const createMenuSpecialRecordSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(160),
  subtitle: z
    .string()
    .trim()
    .max(240)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  category: z.enum(MENU_SPECIAL_CATEGORIES),
  priceLabel: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  mediaKind: z.enum(["image", "video"]),
  storagePath: z.string().trim().min(1).max(500),
  publicUrl: z.string().trim().min(8).max(800),
  durationSeconds: z.number().int().min(1).max(600),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  enabled: z.boolean().default(true),
  addToPlaylistId: z.string().uuid().nullable().optional(),
});

export const updateMenuSpecialSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(160),
  subtitle: z
    .string()
    .trim()
    .max(240)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  category: z.enum(MENU_SPECIAL_CATEGORIES),
  priceLabel: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  durationSeconds: z.number().int().min(1).max(600),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  enabled: z.boolean(),
});

export const createLedPlaylistSchema = z.object({
  name: z.string().trim().min(1, "Playlist name is required.").max(120),
});

export const renameLedPlaylistSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Playlist name is required.").max(120),
});

export const activateLedPlaylistSchema = z.object({
  playlistId: z.string().uuid(),
});

export const addLedPlaylistItemSchema = z.object({
  playlistId: z.string().uuid(),
  sceneId: z.string().uuid(),
  durationSeconds: z.number().int().min(1).max(600).optional(),
});

export const updateLedPlaylistItemSchema = z.object({
  id: z.string().uuid(),
  durationSeconds: z.number().int().min(1).max(600),
  enabled: z.boolean(),
});

export const reorderLedPlaylistItemsSchema = z.object({
  playlistId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1),
});

export const createLedObsSceneSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160),
  obsSceneName: z.string().trim().min(1, "Choose an OBS scene.").max(200),
});

export const createLedMediaSceneSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(160),
  mediaKind: z.enum(["image", "video"]),
  storagePath: z.string().trim().min(1).max(500),
  publicUrl: z.string().trim().min(8).max(800),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  mediaType: z.string().trim().min(1).max(120).optional(),
});

export const updateLedWallSceneSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(160),
  enabled: z.boolean(),
});

export const reorderLedWallScenesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export const ledWallMediaSceneNameSchema = z.object({
  mediaObsSceneName: optionalScene,
});

export const activateLedWallSceneSchema = z.object({
  sceneId: z.string().uuid(),
});

export const ledWallSyncSchema = z.object({
  obsConnected: z.boolean(),
  programScene: z.string().trim().max(200).nullable().optional(),
  scenes: z.array(z.string().trim().min(1).max(200)).max(200),
});

export const startScreenTakeoverSchema = z.object({
  adId: z.string().uuid(),
  minutes: z.number().int().min(1).max(SCREEN_TAKEOVER_MAX_MINUTES).nullable(),
});

export const startTriviaSchema = z.object({
  packId: z.string().uuid(),
  questionCount: z.number().int().min(1).max(50).optional(),
  lobbySeconds: z.number().int().min(15).max(600).optional(),
  questionSeconds: z.number().int().min(8).max(120).optional(),
});

export const importTriviaCsvSchema = z.object({
  packId: z.string().uuid(),
  csvText: z.string().trim().min(1).max(500_000),
  replace: z.boolean().default(true),
});

export const importEventsCsvSchema = z.object({
  csvText: z.string().trim().min(1).max(500_000),
});

export const triviaJoinSchema = z.object({
  joinCode: z.string().trim().min(4).max(8),
  displayName: z.string().trim().min(1).max(24),
});

export const triviaAnswerSchema = z.object({
  choiceIndex: z.number().int().min(0).max(3),
});

const cameraCapabilitySchema = z.object({
  ptz: z.boolean().optional(),
  zoom: z.boolean().optional(),
  presets: z.boolean().optional(),
  presetSave: z.boolean().optional(),
  focus: z.boolean().optional(),
  preview: z.boolean().optional(),
  speeds: z.array(z.number().int().min(1).max(24)).max(12).optional(),
  presetsList: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(64),
        label: z.string().trim().min(1).max(80),
      }),
    )
    .max(64)
    .optional(),
});

export const cameraConnectorPairSchema = z.object({
  code: z.string().trim().min(6).max(32),
  label: z.string().trim().min(1).max(120).optional(),
  hostname: z.string().trim().min(1).max(200).optional(),
  connectorVersion: z.string().trim().min(1).max(40).optional(),
});

export const cameraInventoryUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  sourceKey: z
    .string()
    .trim()
    .min(1, "Source key is required.")
    .max(200)
    .regex(/^[a-z0-9][a-z0-9._-]*$/i, "Use letters, numbers, dots, dashes, or underscores."),
  title: z.string().trim().min(1, "Title is required.").max(160),
  protocol: z.enum(["simulated", "ndi_ptz", "visca_udp", "visca_tcp", "unknown"]),
  connectionTarget: z.string().trim().max(200).optional().nullable(),
  connectionPort: z.number().int().min(1).max(65535).optional().nullable(),
  isProgramOutput: z.boolean().default(false),
  supportsPtz: z.boolean().default(true),
  supportsZoom: z.boolean().default(true),
  supportsPresets: z.boolean().default(true),
  supportsPresetSave: z.boolean().default(false),
  supportsFocus: z.boolean().default(false),
  enabled: z.boolean().default(true),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const cameraInventoryDeleteSchema = z.object({
  id: z.string().uuid(),
});

export const cameraSourceDeleteSchema = z.object({
  cameraId: z.string().uuid(),
});

export const discoveredNdiSourceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  urlAddress: z.string().trim().max(300).nullable().optional(),
  sourceKey: z.string().trim().min(1).max(200),
});

export const cameraConnectorSyncSchema = z.object({
  hostname: z.string().trim().max(200).nullable().optional(),
  connectorVersion: z.string().trim().max(40).nullable().optional(),
  remoteControlEnabled: z.boolean(),
  statusDetail: z.string().trim().max(500).nullable().optional(),
  discoveredNdi: z.array(discoveredNdiSourceSchema).max(64).optional(),
  ndiNote: z.string().trim().max(400).nullable().optional(),
  cameras: z
    .array(
      z.object({
        sourceKey: z.string().trim().min(1).max(200),
        title: z.string().trim().min(1).max(160),
        protocol: z.enum(["simulated", "ndi_ptz", "visca_udp", "visca_tcp", "unknown"]),
        isSimulated: z.boolean().optional(),
        isProgramOutput: z.boolean().optional(),
        supportsPtz: z.boolean().optional(),
        supportsZoom: z.boolean().optional(),
        supportsPresets: z.boolean().optional(),
        supportsPresetSave: z.boolean().optional(),
        supportsFocus: z.boolean().optional(),
        online: z.boolean().optional(),
        lastError: z.string().trim().max(500).nullable().optional(),
        connectionTarget: z.string().trim().max(200).nullable().optional(),
        connectionPort: z.number().int().min(1).max(65535).nullable().optional(),
        linkStatus: z
          .enum([
            "unknown",
            "simulated",
            "ndi_pending",
            "ndi_live",
            "visca_pending",
            "visca_live",
            "offline",
            "error",
          ])
          .optional(),
        inventoryId: z.string().uuid().nullable().optional(),
        capabilities: cameraCapabilitySchema.optional(),
        sortOrder: z.number().int().min(0).max(10_000).optional(),
      }),
    )
    .max(64),
  commandResults: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["accepted", "rejected", "expired", "completed"]),
        rejectReason: z.string().trim().max(300).nullable().optional(),
      }),
    )
    .max(100)
    .optional(),
  previewUpdates: z
    .array(
      z.object({
        sessionId: z.string().uuid(),
        status: z.enum(["active", "ended", "failed"]).optional(),
        snapshotBase64: z.string().max(2_800_000).optional(),
        snapshotContentType: z.enum(["image/jpeg", "image/png"]).optional(),
        answerSdp: z.string().max(200_000).nullable().optional(),
        iceTrickle: z.array(z.unknown()).max(50).optional(),
        error: z.string().trim().max(500).optional(),
      }),
    )
    .max(8)
    .optional(),
});

export const cameraControlCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    cameraId: z.string().uuid(),
    kind: z.literal("ptz_move"),
    payload: z.object({
      direction: z.enum(["up", "down", "left", "right", "up_left", "up_right", "down_left", "down_right"]),
      speed: z.number().int().min(1).max(24),
    }),
  }),
  z.object({
    cameraId: z.string().uuid(),
    kind: z.literal("ptz_stop"),
    payload: z.object({}).optional(),
  }),
  z.object({
    cameraId: z.string().uuid(),
    kind: z.literal("ptz_zoom"),
    payload: z.object({
      direction: z.enum(["in", "out"]),
      speed: z.number().int().min(1).max(24),
    }),
  }),
  z.object({
    cameraId: z.string().uuid(),
    kind: z.literal("ptz_preset_recall"),
    payload: z.object({
      presetId: z.string().trim().min(1).max(64),
    }),
  }),
  z.object({
    cameraId: z.string().uuid(),
    kind: z.literal("ptz_preset_save"),
    payload: z.object({
      presetId: z.string().trim().min(1).max(64),
      label: z.string().trim().min(1).max(80).optional(),
    }),
  }),
  z.object({
    cameraId: z.string().uuid(),
    kind: z.literal("ptz_focus"),
    payload: z.object({
      direction: z.enum(["near", "far", "auto"]),
    }),
  }),
]);

export const cameraLeaseSchema = z.object({
  cameraId: z.string().uuid(),
});

export const cameraPreviewStartSchema = z.object({
  cameraId: z.string().uuid(),
  mode: z.enum(["snapshot", "webrtc"]).default("snapshot"),
  offerSdp: z.string().max(200_000).optional(),
});

export const revokeCameraDeviceSchema = z.object({
  deviceId: z.string().uuid(),
});

/** Treat blank strings as omitted so optional pair fields do not fail min(1). */
const optionalPairText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

export const displayDevicePairSchema = z.object({
  // Allow messy pastes; route normalizes and enforces length >= 6.
  code: z.string().trim().min(1).max(64),
  label: optionalPairText(120),
  kind: z.enum(["led_runner", "vertical_kiosk", "production_runner"]).optional(),
  hostname: optionalPairText(200),
  appVersion: optionalPairText(40),
  capabilities: z.record(z.string(), z.any()).optional(),
});

/** Coerce finite numbers (including numeric strings / floats) into non-negative ints. */
const softNonNegInt = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return value;
  return Math.max(0, Math.round(n));
}, z.number().int().nonnegative().optional());

const softNonNegIntNullable = z.preprocess((value) => {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return value;
  return Math.max(0, Math.round(n));
}, z.number().int().nonnegative().nullable().optional());

/** Accept ISO timestamps with or without a trailing Z / offset. */
const softIsoDatetime = z.preprocess((value) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toISOString();
}, z.string().datetime().nullable().optional());

const softRecord = z.preprocess((value) => {
  if (value == null) return undefined;
  if (Array.isArray(value)) return undefined;
  if (typeof value === "object") return value;
  return undefined;
}, z.record(z.string(), z.any()).optional());

const softRecordNullable = z.preprocess((value) => {
  if (value == null) return null;
  if (Array.isArray(value)) return null;
  if (typeof value === "object") return value;
  return null;
}, z.record(z.string(), z.any()).nullable().optional());

export const displayDeviceHeartbeatSchema = z.object({
  appVersion: z.string().trim().min(1).max(40).optional(),
  // Older runners may still echo a pre-hash pipe-joined revision (>500 chars).
  // Truncate for validation/storage; inequality still forces a manifest refresh.
  manifestRevision: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().slice(0, 500) : value),
    z.string().max(500).optional().nullable(),
  ),
  currentAssetId: z.string().trim().max(120).optional().nullable(),
  playbackState: z.string().trim().max(80).optional().nullable(),
  obs: z
    .object({
      connected: z.boolean(),
      programScene: z.string().trim().max(200).nullable().optional(),
      scenes: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
    })
    .optional(),
  cache: z
    .object({
      bytesUsed: softNonNegInt,
      bytesLimit: softNonNegInt,
      assetsReady: softNonNegInt,
      assetsPending: softNonNegInt,
    })
    .optional(),
  downloads: z
    .object({
      active: z
        .array(
          z.object({
            assetId: z.string().trim().min(1).max(120),
            bytesReceived: softNonNegInt,
            bytesTotal: softNonNegInt,
          }),
        )
        .max(20)
        .optional(),
    })
    .optional(),
  performance: z
    .object({
      mode: z.enum(["normal", "performance"]).optional(),
      revision: softNonNegInt,
      audioMuted: z.boolean().optional(),
      audioVolume: z.number().min(0).max(1).optional(),
      nowPlaying: z
        .object({
          queueItemId: z.string().max(80).optional().nullable(),
          recordingId: z.string().max(64).optional().nullable(),
          displayTitle: z.string().max(500).optional().nullable(),
          positionSeconds: z.number().nonnegative().optional().nullable(),
          durationSeconds: z.number().nonnegative().optional().nullable(),
          paused: z.boolean().optional(),
          status: z.string().max(40).optional().nullable(),
        })
        .passthrough()
        .nullable()
        .optional(),
      queue: z.array(z.unknown()).max(200).optional(),
      lastError: z.string().max(500).nullable().optional(),
      recordingsRoot: z.string().max(2000).nullable().optional(),
      lastScanAt: softIsoDatetime,
      catalogCount: softNonNegInt,
    })
    .passthrough()
    .optional(),
  // Keep ecamm permissive — a bad Ecamm sample must not take the LED runner offline.
  ecamm: z
    .object({
      connected: z.boolean().optional(),
      connectionPhase: z.string().trim().max(80).optional().nullable(),
      permission: z.string().trim().max(80).optional().nullable(),
      host: z.string().trim().max(200).optional().nullable(),
      hostname: z.string().trim().max(200).optional().nullable(),
      serviceName: z.string().trim().max(200).optional().nullable(),
      uuid: z.string().trim().max(80).optional().nullable(),
      clientName: z.string().trim().max(80).optional().nullable(),
      clientVersion: z.string().trim().max(40).optional().nullable(),
      lastSuccessAt: z.string().optional().nullable(),
      lastError: z.string().max(500).optional().nullable(),
      currentSceneId: z.string().max(200).optional().nullable(),
      currentSceneLabel: z.string().max(200).optional().nullable(),
      buttonLabel: z.string().max(200).optional().nullable(),
      pauseButtonLabel: z.string().max(200).optional().nullable(),
      broadcast: softRecordNullable,
      viewers: softNonNegIntNullable,
      previewMode: z.boolean().optional().nullable(),
      mute: z.boolean().optional().nullable(),
      zoomInMeeting: z.boolean().optional().nullable(),
      zoom: softRecordNullable,
      currentMode: z.string().max(80).optional().nullable(),
      defaultCameraId: z.string().max(200).optional().nullable(),
      liveCameraKnown: z.boolean().optional(),
      volumes: softRecord,
      mutes: softRecord,
      lists: softRecord,
      discovered: z.array(z.any()).max(100).optional(),
      stateFingerprint: z.string().max(2000).optional().nullable(),
      unmappedKeys: z.array(z.any()).max(200).optional(),
      endpointSupport: softRecord,
      favorites: softRecord,
      allowPerBusMute: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
  diskFreeBytes: softNonNegIntNullable,
  lastError: z.string().trim().max(500).optional().nullable(),
});

export const createDisplayPairingCodeSchema = z.object({
  kind: z.enum(["led_runner", "vertical_kiosk", "production_runner"]),
});

export const revokeDisplayDeviceSchema = z.object({
  deviceId: z.string().uuid(),
});

export const requestDisplaySafeRefreshSchema = z.object({
  deviceId: z.string().uuid(),
});
