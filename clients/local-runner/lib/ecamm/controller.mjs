/**
 * Ecamm connection controller: discovery, approval, polling, command execution.
 * OBS and Ecamm state are independent.
 */

import { hostname as osHostname } from "node:os";
import { EcammClient } from "./client.mjs";
import {
  CLIENT_NAME,
  CLIENT_VERSION,
  ConnectionPermission,
  DISCOVERY_WINDOW_MS,
  isNonIdempotentEndpoint,
  isVerifiedEndpoint,
  MAX_BACKOFF_MS,
  MEDIUM_TIER_EVERY,
  POLL_FLOOR_MS,
  REDISCOVER_INTERVAL_MS,
  SCENE_CONFIRM_POLL_MS,
  SCENE_CONFIRM_TIMEOUT_MS,
  SLOW_TIER_EVERY,
  VERIFIED_ENDPOINTS,
} from "./constants.mjs";
import {
  discoverEcammInstances,
  matchInstance,
  pickHostAddress,
  splitHost,
} from "./discovery.mjs";
import { EcammHttp, isAbortError } from "./http.mjs";
import {
  ensureEcammUuid,
  loadAcknowledgedProductionIds,
  loadEcammSettings,
  persistAcknowledgedProductionIds,
  saveEcammSettings,
} from "./identity.mjs";
import { inferBroadcastState } from "./parsers.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function emptyLists() {
  return {
    scenes: [],
    overlays: [],
    inputs: [],
    videos: [],
    sounds: [],
    soundFolders: [],
    audioFilters: [],
    profiles: [],
    channels: [],
  };
}

export function createEcammController(options = {}) {
  const log = options.log || (async () => {});
  const discover = options.discover || discoverEcammInstances;
  const deviceName = options.deviceName || osHostname() || "Local Runner";

  let settings = null;
  let http = null;
  let client = null;
  let pollTimer = null;
  let rediscoverTimer = null;
  let stopped = false;
  let tickCount = 0;
  let failures = 0;
  let slowTierDue = true;
  let overlaysStale = false;
  let overlayEpoch = 0;
  let commandQueue = Promise.resolve();
  let lastVolumeCommandAt = 0;
  let acknowledgedIds = new Set();

  const endpointSupport = Object.fromEntries(
    Object.keys(VERIFIED_ENDPOINTS).map((name) => [name, { supported: null, lastError: null, lastOkAt: null }]),
  );

  const state = {
    connectionState: "offline", // discovery | awaiting_approval | denied | connected | offline | reconnecting
    permission: ConnectionPermission.NotFound,
    connected: false,
    host: null,
    selectedHostname: null,
    selectedServiceName: null,
    discovered: [],
    lastSuccessAt: null,
    lastError: null,
    info: null,
    broadcast: inferBroadcastState(""),
    currentMode: null,
    defaultCameraId: null,
    lists: emptyLists(),
    endpointSupport,
    favorites: { scenes: [], overlays: [] },
    allowPerBusMute: false,
    uuid: null,
  };

  function setConnectionState(next, error = null) {
    state.connectionState = next;
    if (error) state.lastError = String(error);
  }

  async function init() {
    settings = await ensureEcammUuid(await loadEcammSettings());
    acknowledgedIds = await loadAcknowledgedProductionIds();
    state.uuid = settings.uuid;
    state.selectedHostname = settings.selectedHostname;
    state.selectedServiceName = settings.selectedServiceName;
    state.favorites = settings.favorites || { scenes: [], overlays: [] };
    state.allowPerBusMute = Boolean(settings.allowPerBusMute);

    http = new EcammHttp({
      host: settings.lastHost || "",
      uuid: settings.uuid,
      clientName: CLIENT_NAME,
      clientVersion: CLIENT_VERSION,
      deviceName,
      log: (level, message) => {
        void log(`[ecamm:${level}] ${message}`);
      },
      verbose: Boolean(options.verbose),
    });
    client = new EcammClient(http);

    if (settings.selectedHostname || settings.lastHost) {
      setConnectionState("reconnecting");
      await tryConnect();
    } else {
      setConnectionState("discovery");
      await runDiscovery();
    }

    schedulePoll();
    scheduleRediscovery();
    return getPublicState();
  }

  function schedulePoll() {
    if (pollTimer) clearTimeout(pollTimer);
    if (stopped) return;
    const delay = state.connected
      ? POLL_FLOOR_MS
      : Math.min(MAX_BACKOFF_MS, POLL_FLOOR_MS * Math.max(1, 2 ** Math.min(failures, 4)));
    pollTimer = setTimeout(() => {
      void pollTick().finally(() => schedulePoll());
    }, delay);
  }

  function scheduleRediscovery() {
    if (rediscoverTimer) clearInterval(rediscoverTimer);
    rediscoverTimer = setInterval(() => {
      if (stopped) return;
      if (state.connected) return;
      if (settings?.deniedUntilManualRetry) return;
      void tryRediscover();
    }, REDISCOVER_INTERVAL_MS);
  }

  async function runDiscovery() {
    try {
      const found = await discover(DISCOVERY_WINDOW_MS);
      state.discovered = found;
      if (!settings.selectedHostname && found.length === 1) {
        // Do not auto-select a single Mac silently across restarts of different machines —
        // only remember after explicit select. Keep discovery list for admin UI.
      }
      return found;
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      return [];
    }
  }

  async function selectHost(input) {
    const hostname = String(input.hostname || "").trim();
    if (!hostname) return { ok: false, rejectReason: "hostname required" };
    const found = await discover(DISCOVERY_WINDOW_MS);
    state.discovered = found;
    const match = matchInstance(found, { hostname, address: input.address });
    if (!match) {
      return { ok: false, rejectReason: `No Ecamm instance matched hostname ${hostname}.` };
    }
    const address = pickHostAddress(match, input.address || settings.preferredAddress);
    const host = `${address}:${match.port}`;
    settings = await saveEcammSettings({
      ...settings,
      selectedHostname: match.hostname,
      selectedServiceName: match.name,
      preferredAddress: address,
      lastHost: host,
      deniedUntilManualRetry: false,
    });
    state.selectedHostname = match.hostname;
    state.selectedServiceName = match.name;
    http.setHost(host);
    state.host = host;
    setConnectionState("reconnecting");
    await tryConnect();
    return { ok: true };
  }

  async function forgetHost() {
    settings = await saveEcammSettings({
      ...settings,
      selectedHostname: null,
      selectedServiceName: null,
      preferredAddress: null,
      lastHost: null,
      deniedUntilManualRetry: false,
    });
    state.selectedHostname = null;
    state.selectedServiceName = null;
    state.host = null;
    state.connected = false;
    state.lists = emptyLists();
    state.info = null;
    http.setHost("");
    setConnectionState("discovery");
    await runDiscovery();
    return { ok: true };
  }

  async function tryRediscover() {
    if (!settings?.selectedHostname) {
      await runDiscovery();
      return;
    }
    setConnectionState(state.connected ? "connected" : "reconnecting");
    const found = await discover(DISCOVERY_WINDOW_MS);
    state.discovered = found;
    const match = matchInstance(found, {
      hostname: settings.selectedHostname,
      address: settings.preferredAddress,
    });
    if (!match) {
      state.connected = false;
      setConnectionState("offline", "Selected Mac not found on the network.");
      return;
    }
    const address = pickHostAddress(match, settings.preferredAddress);
    const host = `${address}:${match.port}`;
    if (host !== http.host) {
      http.setHost(host);
      settings = await saveEcammSettings({ ...settings, lastHost: host, preferredAddress: address });
      await log(`Ecamm rediscovered at ${host} (${match.hostname})`);
    }
    state.host = host;
    await tryConnect();
  }

  async function requestRegistration() {
    // getInfo against an unregistered client triggers the approval entry.
    try {
      await client.getInfo();
    } catch {
      /* expected while pending */
    }
  }

  async function tryConnect() {
    if (!http.host && settings?.lastHost) http.setHost(settings.lastHost);
    if (!http.host) {
      setConnectionState("discovery");
      return false;
    }
    if (settings?.deniedUntilManualRetry) {
      setConnectionState("denied");
      state.permission = ConnectionPermission.Denied;
      return false;
    }

    try {
      state.permission = await markEndpoint("getConnectionStatus", () => client.getConnectionStatus());
      if (state.permission === ConnectionPermission.NotFound) {
        await requestRegistration();
        state.permission = await markEndpoint("getConnectionStatus", () => client.getConnectionStatus());
      }
    } catch (error) {
      state.connected = false;
      failures += 1;
      setConnectionState("offline", error instanceof Error ? error.message : String(error));
      return false;
    }

    if (state.permission === ConnectionPermission.Denied) {
      state.connected = false;
      settings = await saveEcammSettings({ ...settings, deniedUntilManualRetry: true });
      setConnectionState("denied", "Approve was denied in Ecamm. Fix Remote Control settings, then retry.");
      return false;
    }
    if (state.permission === ConnectionPermission.Pending || state.permission === ConnectionPermission.NotFound) {
      state.connected = false;
      setConnectionState(
        "awaiting_approval",
        "Approve “FloBama OS” in Ecamm Live → Settings → Remote Control.",
      );
      return false;
    }

    state.connected = true;
    failures = 0;
    setConnectionState("connected");
    state.host = http.host;
    await refreshAll();
    return true;
  }

  async function markEndpoint(name, fn) {
    try {
      const result = await fn();
      endpointSupport[name] = { supported: true, lastError: null, lastOkAt: new Date().toISOString() };
      return result;
    } catch (error) {
      endpointSupport[name] = {
        supported: false,
        lastError: error instanceof Error ? error.message : String(error),
        lastOkAt: endpointSupport[name]?.lastOkAt ?? null,
      };
      throw error;
    }
  }

  async function refreshAll() {
    await refreshStatus();
    await refreshMedium();
    await refreshSlow();
    slowTierDue = false;
  }

  async function refreshStatus() {
    const info = await markEndpoint("getInfo", () => client.getInfo());
    state.info = info;
    state.broadcast = inferBroadcastState(info.buttonLabel);
    state.lastSuccessAt = new Date().toISOString();
    state.lastError = null;
  }

  async function refreshMedium() {
    try {
      const [currentScene, currentMode, defaultCamera] = await Promise.all([
        markEndpoint("getCurrentScene", () => client.getCurrentScene()).catch(() => state.info?.currentSceneId || ""),
        markEndpoint("getCurrentMode", () => client.getCurrentMode()).catch(() => null),
        markEndpoint("getDefaultCamera", () => client.getDefaultCamera()).catch(() => ""),
      ]);
      if (currentScene) {
        if (state.info) state.info = { ...state.info, currentSceneId: currentScene };
      }
      state.currentMode = currentMode ?? state.currentMode;
      state.defaultCameraId = defaultCamera || state.defaultCameraId;
      if (overlaysStale || !state.lists.overlays.length) {
        await fetchOverlays();
      }
    } catch (error) {
      if (!isAbortError(error)) state.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  async function refreshSlow() {
    try {
      const [scenes, inputs, videos, soundsPayload, filters, profiles, channels] = await Promise.all([
        markEndpoint("getSceneList", () => client.getSceneList()),
        markEndpoint("getInputs", () => client.getInputs()),
        markEndpoint("getVideoList", () => client.getVideoList()),
        markEndpoint("getSoundList", () => client.getSoundList()),
        markEndpoint("getAudioFilterList", () => client.getAudioFilterList()),
        markEndpoint("getProfileList", () => client.getProfileList()),
        markEndpoint("getChannels", () => client.getChannels()),
      ]);
      state.lists = {
        ...state.lists,
        scenes,
        inputs,
        videos,
        sounds: soundsPayload.sounds,
        soundFolders: soundsPayload.folders,
        audioFilters: filters,
        profiles,
        channels,
      };
      await fetchOverlays();
    } catch (error) {
      if (!isAbortError(error)) state.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  async function fetchOverlays() {
    const epoch = ++overlayEpoch;
    try {
      const overlays = await markEndpoint("getOverlayList", () => client.getOverlayList());
      if (epoch !== overlayEpoch) return;
      state.lists = { ...state.lists, overlays };
      overlaysStale = false;
    } catch {
      overlaysStale = true;
    }
  }

  async function pollTick() {
    if (stopped) return;
    if (!state.connected) {
      if (state.connectionState === "awaiting_approval" || state.connectionState === "reconnecting") {
        await tryConnect();
      }
      return;
    }
    tickCount += 1;
    try {
      await refreshStatus();
      if (tickCount % MEDIUM_TIER_EVERY === 0 || overlaysStale) await refreshMedium();
      if (slowTierDue || tickCount % SLOW_TIER_EVERY === 0) {
        await refreshSlow();
        slowTierDue = false;
      }
      failures = 0;
    } catch (error) {
      failures += 1;
      state.connected = false;
      setConnectionState("reconnecting", error instanceof Error ? error.message : String(error));
    }
  }

  async function confirmSceneChange(previousId, expectedId) {
    const deadline = Date.now() + SCENE_CONFIRM_TIMEOUT_MS;
    let liveId = previousId;
    let first = true;
    while (first || Date.now() < deadline) {
      if (!first) await sleep(SCENE_CONFIRM_POLL_MS);
      first = false;
      liveId = await client.getCurrentScene();
      const settled = expectedId ? liveId === expectedId : liveId !== previousId;
      if (settled) return liveId;
    }
    overlaysStale = true;
    return liveId;
  }

  async function applySceneChange({ expectedId } = {}) {
    const previousId = state.info?.currentSceneId || "";
    try {
      const liveId = await confirmSceneChange(previousId, expectedId);
      if (state.info) state.info = { ...state.info, currentSceneId: liveId };
      await fetchOverlays();
    } catch (error) {
      overlaysStale = true;
      if (!isAbortError(error)) {
        await log(`Could not refresh overlays after scene change: ${error}`);
      }
    }
  }

  function enqueue(task) {
    const run = commandQueue.then(task, task);
    commandQueue = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  async function executeEcammCall(payload, { allowReplay = true } = {}) {
    const endpoint = String(payload?.endpoint || "").trim();
    if (!isVerifiedEndpoint(endpoint)) {
      return { status: "rejected", rejectReason: `Endpoint not allowlisted: ${endpoint}` };
    }
    if (!state.connected && !endpoint.startsWith("get")) {
      return { status: "rejected", rejectReason: "Ecamm is not connected." };
    }
    if (endpoint === "setMute" && payload?.params?.bus && !state.allowPerBusMute) {
      return {
        status: "rejected",
        rejectReason:
          "Per-bus setMute is undocumented. Enable allowPerBusMute in Devices & Diagnostics after venue testing.",
      };
    }
    if (!allowReplay && isNonIdempotentEndpoint(endpoint)) {
      return {
        status: "rejected",
        rejectReason: "Non-idempotent action was not replayed after uncertainty.",
      };
    }

    return enqueue(async () => {
      try {
        // Debounce volume floods
        if (endpoint === "setVolume") {
          const now = Date.now();
          if (now - lastVolumeCommandAt < 80) await sleep(80);
          lastVolumeCommandAt = Date.now();
        }

        const params = payload?.params && typeof payload.params === "object" ? payload.params : undefined;
        const meta = VERIFIED_ENDPOINTS[endpoint];
        if (meta.kind === "read") {
          const result = await markEndpoint(endpoint, () => client.call(endpoint, params, { asAction: false }));
          return { status: "completed", result };
        }

        await markEndpoint(endpoint, () => client.call(endpoint, params, { asAction: true }));

        if (endpoint === "setScene") {
          await applySceneChange({ expectedId: params?.id });
        } else if (endpoint === "setNext" || endpoint === "setPrev") {
          await applySceneChange({});
        } else if (endpoint === "setProfile") {
          slowTierDue = true;
          await refreshSlow();
        } else {
          // Fast status refresh without violating getInfo floor too aggressively
          await refreshStatus().catch(() => {});
          if (endpoint === "setOverlay") await fetchOverlays().catch(() => {});
        }

        return { status: "completed", result: { ok: true, confirmed: endpoint === "setScene" } };
      } catch (error) {
        return {
          status: "rejected",
          rejectReason: error instanceof Error ? error.message : String(error),
          uncertain: isNonIdempotentEndpoint(endpoint),
        };
      }
    });
  }

  async function applyProductionCommand(command) {
    const id = command?.id;
    const kind = command?.kind;
    const payload = command?.payload && typeof command.payload === "object" ? command.payload : {};
    const expiresAt = command?.expiresAt || command?.expires_at;

    if (id && acknowledgedIds.has(id)) {
      return { status: "completed", rejectReason: null, deduped: true };
    }
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      return { status: "expired", rejectReason: "Command TTL expired before execution." };
    }

    let result;
    switch (kind) {
      case "ecamm_discover":
        await runDiscovery();
        result = { status: "completed", result: { discovered: state.discovered } };
        break;
      case "ecamm_select_host":
        result = await selectHost(payload);
        result = result.ok
          ? { status: "completed" }
          : { status: "rejected", rejectReason: result.rejectReason };
        break;
      case "ecamm_forget_host":
        await forgetHost();
        result = { status: "completed" };
        break;
      case "ecamm_refresh":
        if (typeof payload.allowPerBusMute === "boolean") {
          await setAllowPerBusMute(payload.allowPerBusMute);
        }
        if (payload.favorites && typeof payload.favorites === "object") {
          await setFavorites(payload.favorites);
        }
        if (!state.connected) {
          await tryConnect();
        } else {
          slowTierDue = true;
          await refreshAll();
        }
        result = { status: "completed" };
        break;
      case "ecamm_diagnostics_probe": {
        const endpoint = String(payload.endpoint || "").trim();
        if (!isVerifiedEndpoint(endpoint)) {
          result = { status: "rejected", rejectReason: "Endpoint not allowlisted." };
          break;
        }
        try {
          const probe = await client.call(endpoint, payload.params, {
            asAction: Boolean(payload.asAction) || endpoint.startsWith("set"),
          });
          // Sanitize large image bodies
          let sanitized = probe;
          if (probe?.json?.icon && typeof probe.json.icon === "string") {
            sanitized = {
              ok: true,
              json: {
                icon: `[base64 jpg ${probe.json.icon.length} chars]`,
                truncated: true,
              },
            };
          }
          result = { status: "completed", result: sanitized };
        } catch (error) {
          result = {
            status: "rejected",
            rejectReason: error instanceof Error ? error.message : String(error),
          };
        }
        break;
      }
      case "ecamm_call":
        result = await executeEcammCall(payload, { commandId: id, allowReplay: payload.allowReplay !== false });
        break;
      default:
        result = { status: "rejected", rejectReason: `Unknown production command: ${kind}` };
    }

    if (id) {
      acknowledgedIds.add(id);
      await persistAcknowledgedProductionIds(acknowledgedIds);
    }
    return result;
  }

  function getPublicState() {
    const { address, port } = splitHost(state.host || "");
    return {
      connectionState: state.connectionState,
      permission: state.permission,
      connected: state.connected,
      host: state.host,
      hostAddress: address || null,
      hostPort: port ?? null,
      selectedHostname: state.selectedHostname,
      selectedServiceName: state.selectedServiceName,
      discovered: state.discovered,
      lastSuccessAt: state.lastSuccessAt,
      lastError: state.lastError,
      uuid: state.uuid,
      clientName: CLIENT_NAME,
      clientVersion: CLIENT_VERSION,
      info: state.info
        ? {
            buttonLabel: state.info.buttonLabel,
            pauseButtonLabel: state.info.pauseButtonLabel,
            currentSceneId: state.info.currentSceneId,
            currentSceneOrigId: state.info.currentSceneOrigId,
            viewers: state.info.viewers,
            mute: state.info.mute,
            previewMode: state.info.previewMode,
            hidingUi: state.info.hidingUi,
            liveDemo: state.info.liveDemo,
            volumes: state.info.volumes,
            mutes: state.info.mutes,
            zoom: state.info.zoom,
            unmappedKeys: state.info.unmappedKeys,
          }
        : null,
      broadcast: state.broadcast,
      currentMode: state.currentMode,
      defaultCameraId: state.defaultCameraId,
      liveCameraKnown: false,
      lists: state.lists,
      favorites: state.favorites,
      allowPerBusMute: state.allowPerBusMute,
      endpointSupport: state.endpointSupport,
      approvalInstructions:
        "In Ecamm Live on the production Mac: Settings → Remote Control → approve “FloBama OS”. If Denied, remove the client or switch it to Allowed, then retry from Devices & Diagnostics.",
    };
  }

  async function setAllowPerBusMute(enabled) {
    settings = await saveEcammSettings({ ...settings, allowPerBusMute: Boolean(enabled) });
    state.allowPerBusMute = Boolean(enabled);
    return { ok: true };
  }

  async function setFavorites(favorites) {
    settings = await saveEcammSettings({
      ...settings,
      favorites: {
        scenes: Array.isArray(favorites?.scenes) ? favorites.scenes.slice(0, 40) : [],
        overlays: Array.isArray(favorites?.overlays) ? favorites.overlays.slice(0, 40) : [],
      },
    });
    state.favorites = settings.favorites;
    return { ok: true };
  }

  async function destroy() {
    stopped = true;
    if (pollTimer) clearTimeout(pollTimer);
    if (rediscoverTimer) clearInterval(rediscoverTimer);
    http?.abortAll();
    state.connected = false;
    setConnectionState("offline");
  }

  /** Alias used by Local Runner main loop / CLI. */
  async function start() {
    if (!settings) await init();
    if (settings.selectedHostname || settings.lastHost) {
      await tryConnect();
    } else {
      await runDiscovery();
    }
    schedulePoll();
    scheduleRediscovery();
    return getPublicState();
  }

  async function stop() {
    return destroy();
  }

  async function discoverNow() {
    return runDiscovery();
  }

  function getIdentity() {
    return {
      uuid: settings?.uuid || state.uuid,
      selectedHostname: settings?.selectedHostname || null,
      selectedServiceName: settings?.selectedServiceName || null,
      preferredAddress: settings?.preferredAddress || null,
      lastHostPort: settings?.lastHost || state.host || null,
      allowPerBusMute: Boolean(settings?.allowPerBusMute),
      favorites: settings?.favorites || state.favorites,
    };
  }

  function getDiagnosticsSnapshot() {
    return {
      ...getPublicState(),
      identity: getIdentity(),
      endpointSupport: state.endpointSupport,
      clientName: CLIENT_NAME,
      clientVersion: CLIENT_VERSION,
    };
  }

  function getHeartbeatEcammPayload() {
    const pub = getPublicState();
    const scenes = (pub.lists.scenes || []).map((s) => ({
      id: s.id,
      label: s.label,
      current: s.current,
      groupName: s.groupName,
    }));
    const overlays = (pub.lists.overlays || []).map((o) => ({
      id: o.id,
      label: o.label,
      visible: o.visible,
      isComment: o.isComment,
    }));
    return {
      connected: pub.connected,
      connectionPhase: pub.connectionState,
      permission: pub.permission,
      host: pub.host,
      hostname: pub.selectedHostname,
      serviceName: pub.selectedServiceName,
      uuid: pub.uuid,
      clientName: CLIENT_NAME,
      clientVersion: CLIENT_VERSION,
      lastSuccessAt: pub.lastSuccessAt,
      lastError: pub.lastError,
      currentSceneId: pub.info?.currentSceneId || null,
      currentSceneLabel: scenes.find((s) => s.id === pub.info?.currentSceneId)?.label || null,
      buttonLabel: pub.info?.buttonLabel || null,
      pauseButtonLabel: pub.info?.pauseButtonLabel || null,
      broadcast: pub.broadcast,
      viewers: pub.info?.viewers ?? null,
      previewMode: pub.info?.previewMode ?? null,
      mute: pub.info?.mute ?? null,
      volumes: pub.info?.volumes || {},
      mutes: pub.info?.mutes || {},
      zoomInMeeting: pub.info?.zoom?.inMeeting ?? null,
      zoom: pub.info?.zoom || null,
      currentMode: pub.currentMode,
      defaultCameraId: pub.defaultCameraId,
      liveCameraKnown: false,
      allowPerBusMute: pub.allowPerBusMute,
      favorites: pub.favorites,
      discovered: pub.discovered || [],
      lists: {
        scenes,
        overlays,
        inputs: pub.lists.inputs || [],
        videos: pub.lists.videos || [],
        sounds: pub.lists.sounds || [],
        soundFolders: pub.lists.soundFolders || [],
        audioFilters: pub.lists.audioFilters || [],
        profiles: pub.lists.profiles || [],
        channels: pub.lists.channels || [],
        sceneCount: scenes.length,
        overlayCount: overlays.length,
        inputCount: (pub.lists.inputs || []).length,
        soundCount: (pub.lists.sounds || []).length,
        profileCount: (pub.lists.profiles || []).length,
      },
      // Compact fingerprint for change-detection on the server
      stateFingerprint: [
        pub.connectionState,
        pub.permission,
        pub.info?.currentSceneId || "",
        pub.info?.buttonLabel || "",
        pub.info?.mute ? "1" : "0",
        pub.info?.previewMode ? "1" : "0",
        pub.info?.zoom?.inMeeting ? "1" : "0",
        String(scenes.length),
        String(overlays.length),
        JSON.stringify(pub.info?.volumes || {}),
      ].join("|"),
      unmappedKeys: pub.info?.unmappedKeys || [],
      endpointSupport: Object.fromEntries(
        Object.entries(pub.endpointSupport || {}).map(([k, v]) => [
          k,
          { supported: v.supported, lastError: v.lastError },
        ]),
      ),
    };
  }

  async function executeCommand(command) {
    return applyProductionCommand(command);
  }

  return {
    init,
    start,
    stop,
    destroy,
    discoverNow,
    getIdentity,
    getDiagnosticsSnapshot,
    getHeartbeatEcammPayload,
    getPublicState,
    executeCommand,
    applyProductionCommand,
    selectHost,
    forgetHost,
    runDiscovery,
    tryConnect,
    setAllowPerBusMute,
    setFavorites,
    /** test hooks */
    _state: state,
    _executeEcammCall: executeEcammCall,
  };
}
