import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { PERFORMANCE_CACHE_DIR } from "./recordings-paths.mjs";

const WALL_FRIENDLY_VIDEO = new Set(["h264", "avc1", "vp8", "vp9", "av1"]);
const WALL_FRIENDLY_AUDIO = new Set(["aac", "mp4a", "opus", "vorbis", "mp3"]);
const WALL_FRIENDLY_CONTAINER = new Set(["mp4", "mov", "m4v", "webm"]);

function runCommand(command, args, { timeoutMs = 20_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, error: `${command} timed out`, stdout, stderr });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message, stdout, stderr });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr, error: code === 0 ? null : stderr.slice(0, 500) });
    });
  });
}

async function findBinary(names) {
  for (const name of names) {
    const result = await runCommand("which", [name], { timeoutMs: 3000 });
    if (result.ok) {
      const path = result.stdout.trim().split("\n")[0];
      if (path) return path;
    }
  }
  return null;
}

/**
 * Probe media metadata only when the file is locally available.
 * Uses ffprobe when installed; otherwise returns a minimal extension-based guess.
 */
export async function probeLocalRecording(filePath) {
  const ffprobe = await findBinary(["ffprobe"]);
  if (!ffprobe) {
    const ext = filePath.toLowerCase().split(".").pop();
    const container = ext || null;
    const compatible = WALL_FRIENDLY_CONTAINER.has(container);
    return {
      ok: true,
      probeTool: "extension-fallback",
      durationSeconds: null,
      container,
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      hasAudio: null,
      playbackCompatible: compatible ? null : false,
      needsConversion: !compatible,
      note: "ffprobe not installed; codec compatibility unknown.",
    };
  }

  const result = await runCommand(ffprobe, [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  if (!result.ok) {
    return { ok: false, error: result.error || "ffprobe failed" };
  }

  let json;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    return { ok: false, error: "ffprobe returned invalid JSON" };
  }

  const streams = Array.isArray(json.streams) ? json.streams : [];
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.find((s) => s.codec_type === "audio");
  const durationSeconds = Number(json.format?.duration) || Number(video?.duration) || null;
  const container = String(json.format?.format_name || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())[0] || null;
  const videoCodec = video?.codec_name ? String(video.codec_name).toLowerCase() : null;
  const audioCodec = audio?.codec_name ? String(audio.codec_name).toLowerCase() : null;
  const width = video?.width ? Number(video.width) : null;
  const height = video?.height ? Number(video.height) : null;

  const containerOk =
    !container ||
    WALL_FRIENDLY_CONTAINER.has(container) ||
    container.includes("mp4") ||
    container.includes("mov") ||
    container.includes("webm");
  const videoOk = !videoCodec || WALL_FRIENDLY_VIDEO.has(videoCodec);
  const audioOk = !audioCodec || WALL_FRIENDLY_AUDIO.has(audioCodec);
  const playbackCompatible = Boolean(containerOk && videoOk && (!audio || audioOk));
  const needsConversion = Boolean(video && !playbackCompatible);

  return {
    ok: true,
    probeTool: "ffprobe",
    durationSeconds: durationSeconds && Number.isFinite(durationSeconds) ? durationSeconds : null,
    container,
    videoCodec,
    audioCodec,
    width,
    height,
    hasAudio: Boolean(audio),
    playbackCompatible,
    needsConversion,
  };
}

/**
 * Bounded remux/convert into performance-cache. Never overwrites Dropbox originals.
 */
export async function convertRecordingToCache(recordingId, sourcePath, { timeoutMs = 30 * 60_000 } = {}) {
  const ffmpeg = await findBinary(["ffmpeg"]);
  if (!ffmpeg) {
    return { ok: false, error: "ffmpeg is not installed on this Mac. Install ffmpeg or remux the file manually." };
  }
  const outPath = join(PERFORMANCE_CACHE_DIR, `${recordingId}.mp4`);
  try {
    await access(outPath);
    return { ok: true, path: outPath, reused: true };
  } catch {
    /* convert */
  }

  const result = await runCommand(
    ffmpeg,
    [
      "-y",
      "-i",
      sourcePath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outPath,
    ],
    { timeoutMs },
  );
  if (!result.ok) {
    return { ok: false, error: result.error || "ffmpeg conversion failed" };
  }
  return { ok: true, path: outPath, reused: false };
}

export function convertedCachePath(recordingId) {
  return join(PERFORMANCE_CACHE_DIR, `${recordingId}.mp4`);
}
