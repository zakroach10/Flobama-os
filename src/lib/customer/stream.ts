import type { LiveState } from "@/lib/customer/types";

/** Mux's public HLS test stream. Used only when Mux credentials are not set. */
export const MUX_FIXTURE_PLAYBACK = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

export type MuxEnv = {
  tokenId: string;
  tokenSecret: string;
  liveStreamId: string;
  playbackId: string;
  fixture: string;
  webhookSecret: string;
};

export function muxEnvFromProcess(env: NodeJS.ProcessEnv = process.env): MuxEnv {
  return {
    tokenId: env.MUX_TOKEN_ID?.trim() ?? "",
    tokenSecret: env.MUX_TOKEN_SECRET?.trim() ?? "",
    liveStreamId: env.MUX_LIVE_STREAM_ID?.trim() ?? "",
    playbackId: env.MUX_PLAYBACK_ID?.trim() ?? "",
    fixture: env.CUSTOMER_STREAM_FIXTURE?.trim() ?? "",
    webhookSecret: env.MUX_WEBHOOK_SECRET?.trim() ?? "",
  };
}

export function muxConfigured(env: MuxEnv): boolean {
  return Boolean(env.tokenId && env.tokenSecret && env.liveStreamId);
}

export function hlsFromPlaybackId(playbackId: string): string {
  return `https://stream.mux.com/${encodeURIComponent(playbackId)}.m3u8`;
}

export function thumbnailFromPlaybackId(playbackId: string): string {
  return `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.jpg?time=10`;
}

export function parsePlaybackId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/stream\.mux\.com\/([A-Za-z0-9]+)/);
  const id = fromUrl?.[1] ?? trimmed;
  if (!/^[A-Za-z0-9]{8,120}$/.test(id)) return null;
  return id;
}

type MuxLiveResponse = {
  data?: {
    status?: string;
    playback_ids?: { id?: string; policy?: string }[];
  };
};

const OFFLINE = "The stage is quiet right now. Check the schedule for the next show.";

export async function getLiveState(env: MuxEnv, fetchImpl: typeof fetch = fetch): Promise<LiveState> {
  if (!muxConfigured(env)) {
    if (env.fixture === "live") {
      return {
        provider: "mux",
        live: true,
        playbackUrl: MUX_FIXTURE_PLAYBACK,
        preview: true,
        message: "Preview stream. Connect Mux to show the FloBama stage.",
      };
    }
    return {
      provider: "mux",
      live: false,
      playbackUrl: null,
      preview: true,
      message: OFFLINE,
    };
  }

  try {
    const auth = Buffer.from(`${env.tokenId}:${env.tokenSecret}`).toString("base64");
    const response = await fetchImpl(
      `https://api.mux.com/video/v1/live-streams/${encodeURIComponent(env.liveStreamId)}`,
      { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } },
    );
    if (!response.ok) {
      return {
        provider: "mux",
        live: false,
        playbackUrl: null,
        preview: false,
        message: "Live video is unavailable right now.",
      };
    }
    const body = (await response.json()) as MuxLiveResponse;
    const playbackId =
      env.playbackId ||
      body.data?.playback_ids?.find((row) => row.policy === "public")?.id ||
      body.data?.playback_ids?.[0]?.id ||
      "";
    if (body.data?.status === "active" && playbackId) {
      return {
        provider: "mux",
        live: true,
        playbackUrl: hlsFromPlaybackId(playbackId),
        preview: false,
        message: "Live from the FloBama stage.",
      };
    }
  } catch {
    return {
      provider: "mux",
      live: false,
      playbackUrl: null,
      preview: false,
      message: "Live video is unavailable right now.",
    };
  }

  return {
    provider: "mux",
    live: false,
    playbackUrl: null,
    preview: false,
    message: OFFLINE,
  };
}
