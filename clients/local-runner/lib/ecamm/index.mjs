export {
  CLIENT_NAME,
  CLIENT_VERSION,
  ECAMM_SERVICE_TYPE as SERVICE_TYPE,
  ECAMM_SERVICE_PROTOCOL as PROTOCOL,
  POLL_FLOOR_MS,
  REQUEST_TIMEOUT_MS,
  DISCOVERY_WINDOW_MS,
  REDISCOVER_INTERVAL_MS,
  ALL_AUDIO_BUSES as AUDIO_BUSES,
  ConnectionPermission,
  VERIFIED_ENDPOINTS as ENDPOINT_REGISTRY,
  isNonIdempotentEndpoint,
  isVerifiedEndpoint,
} from "./constants.mjs";

export { NON_IDEMPOTENT_ACTIONS, ENDPOINT_BY_NAME, PRODUCTION_COMMAND_KINDS } from "./compat.mjs";

export {
  loadEcammSettings as loadIdentity,
  saveEcammSettings as saveIdentity,
  ECAMM_SETTINGS_FILE as DEFAULT_IDENTITY_PATH,
  ensureEcammUuid,
  loadAcknowledgedProductionIds,
  persistAcknowledgedProductionIds,
} from "./identity.mjs";

export {
  buildQuery,
  createHttp,
  isTimeout,
  EcammHttp,
  EcammHttpError as HttpError,
  EcammTimeoutError as TimeoutError,
  EcammParseError as ParseError,
  isAbortError,
} from "./http.mjs";

export {
  yesNo,
  unwrapScalar,
  parseNumeric,
  parseInfo,
  inferBroadcastState as inferSessionFromButtonLabel,
  sceneLabel,
  soundLabel,
  parseSceneList,
  parseOverlayList,
  parseCameraList,
  parseVideoList,
  parseSoundList,
  parseAudioFilterList,
  parseProfileList,
  parseChannelList,
  parseConnectionPermission,
  parseSourceMode,
} from "./parsers.mjs";

export { discoverEcammInstances, matchInstance, splitHost, pickHostAddress } from "./discovery.mjs";

export { EcammClient, createEcammClient } from "./client.mjs";
export { createEcammState } from "./state.mjs";
export { createEcammController } from "./controller.mjs";
export { createShortcutsHandler, validatePathAgainstRoots } from "./shortcuts.mjs";
export {
  handleRecordingCallback,
  ensureRecordingCallbackSecret,
  listRecentRecordingEvents,
  waitForStableFile,
  pathAllowed,
} from "./recording-events.mjs";
