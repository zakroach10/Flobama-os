/** FloBama Local Runner — Ecamm Live Remote Control constants (API v4.4). */

export const ECAMM_SERVICE_TYPE = "ecammliveremote";
export const ECAMM_SERVICE_PROTOCOL = "tcp";
export const DISCOVERY_WINDOW_MS = 3000;
export const REDISCOVER_INTERVAL_MS = 10_000;
export const REQUEST_TIMEOUT_MS = 4000;
export const POLL_FLOOR_MS = 2000;
export const MAX_BACKOFF_MS = 30_000;
export const SCENE_CONFIRM_POLL_MS = 50;
export const SCENE_CONFIRM_TIMEOUT_MS = 2500;
export const MEDIUM_TIER_EVERY = 5;
export const SLOW_TIER_EVERY = 15;

export const CLIENT_NAME = "FloBama OS";
export const CLIENT_VERSION = "1.3.0";

export const ConnectionPermission = {
  Allowed: "Allowed",
  Denied: "Denied",
  Pending: "Pending",
  NotFound: "Not Found",
};

export const AudioBus = {
  Mic: "mic",
  Mic2: "mic2",
  Skype: "skype",
  SystemAudio: "system audio",
  Interview: "interview",
  Zoom: "zoom",
  SoundEffects: "soundeffects",
  Movie: "movie",
  Guest1: "guest_1",
  Guest2: "guest_2",
  Guest3: "guest_3",
  Guest4: "guest_4",
};

export const ALL_AUDIO_BUSES = Object.values(AudioBus);

export const AUDIO_BUS_INFO_SUFFIX = {
  [AudioBus.Mic]: "MIC",
  [AudioBus.Mic2]: "MIC2",
  [AudioBus.Skype]: "SKYPE",
  [AudioBus.SystemAudio]: "SYSTEMAUDIO",
  [AudioBus.Interview]: "INTERVIEW",
  [AudioBus.Zoom]: "ZOOM",
  [AudioBus.SoundEffects]: "SOUNDEFFECTS",
  [AudioBus.Movie]: "MOVIE",
  [AudioBus.Guest1]: "GUEST_1",
  [AudioBus.Guest2]: "GUEST_2",
  [AudioBus.Guest3]: "GUEST_3",
  [AudioBus.Guest4]: "GUEST_4",
};

export const SoundAction = {
  Stop: "stop",
  Loop: "loop",
  Restart: "restart",
};

export const ZoomPanel = {
  Meeting: "meeting",
  Chat: "chat",
  Participants: "participants",
  Share: "share",
};

export const SourceMode = {
  Cam: "cam",
  Screen: "screen",
  Video: "video",
  Blank: "blank",
};

/** Endpoints verified from official v4.4 + Companion client. */
export const VERIFIED_ENDPOINTS = {
  // status
  getConnectionStatus: { kind: "read" },
  getInfo: { kind: "read" },
  getButtonLabel: { kind: "read" },
  getPauseButtonLabel: { kind: "read" },
  getViewers: { kind: "read" },
  getLiveDemo: { kind: "read" },
  getHideShowUI: { kind: "read" },
  getMute: { kind: "read" },
  // lists
  getSceneList: { kind: "read" },
  getSceneDict: { kind: "read" },
  getSceneImage: { kind: "read" },
  getOverlayList: { kind: "read" },
  getOverlayDict: { kind: "read" },
  getOverlayImage: { kind: "read" },
  getInputs: { kind: "read" },
  getVideoList: { kind: "read" },
  getVideoDict: { kind: "read" },
  getVideoImage: { kind: "read" },
  getSoundList: { kind: "read" },
  getSoundDict: { kind: "read" },
  getAudioFilterList: { kind: "read" },
  getAudioFilterDict: { kind: "read" },
  getProfileList: { kind: "read" },
  getChannels: { kind: "read" },
  // currents
  getCurrentScene: { kind: "read" },
  getCurrentMode: { kind: "read" },
  getDefaultCamera: { kind: "read" },
  getVolume: { kind: "read" },
  // broadcast
  setClickButton: { kind: "action", nonIdempotent: true },
  setClickPauseButton: { kind: "toggle", nonIdempotent: true },
  setStartNewRecording: { kind: "action", nonIdempotent: true },
  setComment: { kind: "action" },
  setShowComment: { kind: "action" },
  setHideComment: { kind: "action" },
  setMarker: { kind: "action" },
  // scenes
  setScene: { kind: "action" },
  setNext: { kind: "action" },
  setPrev: { kind: "action" },
  setInput: { kind: "action" },
  setMode: { kind: "action" },
  setVideo: { kind: "action" },
  setPIP: { kind: "toggle", nonIdempotent: true },
  setOverlay: { kind: "toggle", nonIdempotent: true },
  // audio
  setMute: { kind: "toggle", nonIdempotent: true, undocumentedBus: true },
  setVolume: { kind: "action" },
  setAudioFilter: { kind: "toggle", nonIdempotent: true },
  setSound: { kind: "action" },
  setSoundVolume: { kind: "action" },
  setSoundStop: { kind: "action" },
  setSoundPause: { kind: "toggle", nonIdempotent: true },
  // utilities
  setPreviewMode: { kind: "toggle", nonIdempotent: true },
  setPublish: { kind: "action", nonIdempotent: true },
  setProfile: { kind: "action" },
  setLiveDemo: { kind: "toggle", nonIdempotent: true },
  setHideShowUI: { kind: "toggle", nonIdempotent: true },
  // zoom
  setZoomNew: { kind: "action" },
  setZoomLeave: { kind: "action", nonIdempotent: true },
  setZoomPanel: { kind: "toggle", nonIdempotent: true },
  setZoomVideo: { kind: "toggle", nonIdempotent: true },
  setZoomAudio: { kind: "toggle", nonIdempotent: true },
  setZoomMuteAll: { kind: "action", nonIdempotent: true },
  setZoomRaiseHand: { kind: "toggle", nonIdempotent: true },
  setZoomFullScreen: { kind: "toggle", nonIdempotent: true },
  setZoomCloudRecord: { kind: "toggle", nonIdempotent: true },
  setZoomLocalRecord: { kind: "toggle", nonIdempotent: true },
  setZoomPauseRecord: { kind: "toggle", nonIdempotent: true },
  setZoomPrevGallery: { kind: "action" },
  setZoomNextGallery: { kind: "action" },
  setZoomGallerySpeaker: { kind: "toggle", nonIdempotent: true },
  setSpotlightSelf: { kind: "toggle", nonIdempotent: true },
};

export function isVerifiedEndpoint(name) {
  return Boolean(VERIFIED_ENDPOINTS[name]);
}

export function isNonIdempotentEndpoint(name) {
  return Boolean(VERIFIED_ENDPOINTS[name]?.nonIdempotent);
}
