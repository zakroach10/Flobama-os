import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { hashDisplaySecret } from "@/lib/display-devices/crypto";
import { getServerStationSettings } from "@/lib/server-station/settings";
import { isMissingServerStationRelation } from "@/lib/auth/server-station";

export { detectServerStationUploadKind } from "@/lib/server-station/upload-kinds";

export async function resolveServerStationUploadSession(token: string) {
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false as const, message: "Upload is not configured." };

  const tokenHash = hashDisplaySecret(token);
  const { data, error } = await admin
    .from("server_station_upload_sessions")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      message: isMissingServerStationRelation(error.message)
        ? "Server Station upload is not set up on this database yet."
        : error.message,
    };
  }
  if (!data) return { ok: false as const, message: "This upload link is invalid." };
  if (data.consumed_at) return { ok: false as const, message: "This upload link was already used." };
  if (Date.parse(data.expires_at) <= Date.now()) {
    return { ok: false as const, message: "This upload link expired. Scan a new QR on the Server Station." };
  }

  const { settings } = await getServerStationSettings(admin, data.venue_id);
  return { ok: true as const, session: data, admin, maxBytes: settings.max_upload_bytes };
}

export async function prepareServerStationPhoneUpload(input: {
  token: string;
  mediaKind: "image" | "video";
  uploadId: string;
}) {
  const resolved = await resolveServerStationUploadSession(input.token);
  if (!resolved.ok) return resolved;

  const ext = input.mediaKind === "video" ? "mp4" : "jpg";
  const contentType = input.mediaKind === "video" ? "video/mp4" : "image/jpeg";
  const storagePath = `${resolved.session.venue_id}/led/server-phone-${input.uploadId}.${ext}`;

  const { data, error } = await resolved.admin.storage
    .from("screen-ads")
    .createSignedUploadUrl(storagePath);
  if (error || !data) {
    return { ok: false as const, message: error?.message ?? "Could not prepare upload." };
  }

  return {
    ok: true as const,
    venueId: resolved.session.venue_id,
    sessionId: resolved.session.id,
    storagePath,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    contentType,
    maxBytes: resolved.maxBytes,
  };
}

export async function submitServerStationYoutubeLink(input: {
  token: string;
  url: string;
  title?: string | null;
}) {
  const resolved = await resolveServerStationUploadSession(input.token);
  if (!resolved.ok) return resolved;

  if (resolved.session.workflow !== "youtube") {
    return { ok: false as const, message: "This QR is for photo upload, not YouTube." };
  }
  if (resolved.session.consumed_at || resolved.session.submitted_youtube_url) {
    return { ok: false as const, message: "This link was already used. Scan a new QR." };
  }

  const { parseYoutubeVideoUrl } = await import("@/lib/screens/youtube");
  const video = parseYoutubeVideoUrl(input.url);
  if (!video) return { ok: false as const, message: "Paste a full YouTube video link." };

  const title = (input.title?.trim() || video.title).slice(0, 160);
  const { error } = await resolved.admin
    .from("server_station_upload_sessions")
    .update({
      submitted_youtube_url: video.watchUrl,
      submitted_youtube_video_id: video.videoId,
      submitted_youtube_title: title,
      uploaded_at: new Date().toISOString(),
      consumed_at: new Date().toISOString(),
    })
    .eq("id", resolved.session.id)
    .is("consumed_at", null);

  if (error) {
    if (/submitted_youtube|workflow/i.test(error.message)) {
      return {
        ok: false as const,
        message: "YouTube link QR is not set up on this database yet. Ask an admin to apply the latest SQL.",
      };
    }
    return { ok: false as const, message: error.message };
  }
  return {
    ok: true as const,
    message: "Link sent. Return to the Server Station to play it on the wall.",
    videoId: video.videoId,
    watchUrl: video.watchUrl,
    title,
  };
}

export async function completeServerStationPhoneUpload(input: {
  token: string;
  storagePath: string;
  publicUrl: string;
  mediaKind: "image" | "video";
  sha256?: string | null;
  sizeBytes?: number | null;
}) {
  const resolved = await resolveServerStationUploadSession(input.token);
  if (!resolved.ok) return resolved;

  if (!input.storagePath.startsWith(`${resolved.session.venue_id}/led/`)) {
    return { ok: false as const, message: "Upload path is invalid." };
  }

  const { error } = await resolved.admin
    .from("server_station_upload_sessions")
    .update({
      uploaded_url: input.publicUrl,
      uploaded_storage_path: input.storagePath,
      uploaded_media_kind: input.mediaKind,
      uploaded_content_hash: input.sha256 ?? null,
      uploaded_at: new Date().toISOString(),
      consumed_at: new Date().toISOString(),
    })
    .eq("id", resolved.session.id)
    .is("consumed_at", null);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, message: "Upload received. Return to the Server Station to approve it." };
}

export function hashUploadToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
