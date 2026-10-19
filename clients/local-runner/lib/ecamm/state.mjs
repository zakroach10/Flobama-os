import { ConnectionPermission } from "./constants.mjs";
import { inferBroadcastState as inferSessionFromButtonLabel } from "./parsers.mjs";

function emptyInfo() {
  return {
    buttonLabel: "",
    pauseButtonLabel: "",
    currentSceneId: "",
    currentSceneOrigId: "",
    viewers: 0,
    mute: false,
    previewMode: false,
    hidingUi: false,
    liveDemo: false,
    volumes: {},
    mutes: {},
    zoom: {
      inMeeting: false,
      muted: false,
      handRaised: false,
      camOn: false,
      cloudRecording: false,
      localRecording: false,
      recordingPaused: false,
      hosting: false,
    },
    unmappedKeys: [],
  };
}

/**
 * Mutable cache of Ecamm connection + lists for heartbeat / diagnostics.
 */
export function createEcammState() {
  const state = {
    permission: ConnectionPermission.NotFound,
    connected: false,
    connectionPhase: "idle",
    info: emptyInfo(),
    scenes: [],
    overlays: [],
    cameras: [],
    videos: [],
    sounds: [],
    soundFolders: [],
    audioFilters: [],
    profiles: [],
    channels: [],
    sourceMode: undefined,
    defaultCameraId: "",
    lastSuccessAt: null,
    lastError: null,
    endpointStatus: {},
    selected: {
      hostname: null,
      address: null,
      serviceName: null,
      hostPort: null,
    },
    host: "",
    discovered: [],
  };

  function reflagCurrentScene(id) {
    for (const scene of state.scenes) {
      scene.current = scene.id === id;
    }
  }

  function applyInfo(next) {
    const previousId = state.info.currentSceneId;
    state.info = next;
    if (previousId !== next.currentSceneId) reflagCurrentScene(next.currentSceneId);
    state.lastSuccessAt = new Date().toISOString();
    return state;
  }

  function applyList(key, next) {
    state[key] = next;
    if (key === "scenes") reflagCurrentScene(state.info.currentSceneId);
    state.lastSuccessAt = new Date().toISOString();
    return state;
  }

  function setCurrentScene(id) {
    if (state.info.currentSceneId === id) return state;
    state.info = { ...state.info, currentSceneId: id };
    reflagCurrentScene(id);
    return state;
  }

  function setEndpointStatus(name, patch) {
    state.endpointStatus[name] = {
      ...(state.endpointStatus[name] || {}),
      ...patch,
      at: new Date().toISOString(),
    };
  }

  function snapshot() {
    const session = inferSessionFromButtonLabel(state.info.buttonLabel);
    return {
      connected: state.connected,
      connectionPhase: state.connectionPhase,
      permission: state.permission,
      host: state.host,
      selected: { ...state.selected },
      info: {
        buttonLabel: state.info.buttonLabel,
        pauseButtonLabel: state.info.pauseButtonLabel,
        currentSceneId: state.info.currentSceneId,
        viewers: state.info.viewers,
        mute: state.info.mute,
        previewMode: state.info.previewMode,
        hidingUi: state.info.hidingUi,
        liveDemo: state.info.liveDemo,
        volumes: { ...state.info.volumes },
        mutes: { ...state.info.mutes },
        zoom: { ...state.info.zoom },
      },
      session,
      lists: {
        scenes: state.scenes.map((s) => ({ id: s.id, label: s.label, current: s.current, groupName: s.groupName })),
        overlays: state.overlays.map((o) => ({
          id: o.id,
          label: o.label,
          visible: o.visible,
          isComment: o.isComment,
        })),
        cameras: state.cameras,
        videos: state.videos,
        sounds: state.sounds.map((s) => ({ id: s.id, label: s.label, folderName: s.folderName })),
        soundFolders: state.soundFolders,
        audioFilters: state.audioFilters,
        profiles: state.profiles,
        channels: state.channels,
      },
      sourceMode: state.sourceMode,
      defaultCameraId: state.defaultCameraId,
      lastSuccessAt: state.lastSuccessAt,
      lastError: state.lastError,
      discoveredCount: state.discovered.length,
    };
  }

  return {
    state,
    applyInfo,
    applyList,
    setCurrentScene,
    setEndpointStatus,
    snapshot,
    emptyInfo,
  };
}
