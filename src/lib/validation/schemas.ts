import { z } from "zod";
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  EVENT_VISIBILITIES,
  SCREEN_TRANSITIONS,
  SCREEN_WALL_MODES,
  STAFF_ROLES,
} from "@/lib/constants";
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
});

export type CreateStaffValues = z.output<typeof createStaffSchema>;

export const updateStaffRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(STAFF_ROLES),
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
});

export const reorderScreenAdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});
