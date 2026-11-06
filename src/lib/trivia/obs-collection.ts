import {
  TRIVIA_OBS_BROWSER_SOURCE_NAME,
  TRIVIA_OBS_COLLECTION_FILENAME,
  TRIVIA_OBS_COLLECTION_NAME,
  TRIVIA_OBS_SCENE_NAME,
  TRIVIA_WALL_HEIGHT,
  TRIVIA_WALL_WIDTH,
} from "@/lib/constants";

export { TRIVIA_OBS_COLLECTION_FILENAME };

/** OBS 30 absolute-pixel scene collections use version < 2 and omit `resolution`. */
const OBS_COLLECTION_VERSION = 1;
/** LIBOBS_API_VER for OBS 30.0.0. Current OBS accepts this prev_ver on import. */
const OBS_PREV_VER = 503316480;

type ObsVec2 = { x: number; y: number };

export type TriviaObsSceneCollection = {
  name: string;
  version: number;
  current_scene: string;
  current_program_scene: string;
  scene_order: Array<{ name: string }>;
  sources: ObsSource[];
  groups: [];
  transitions: [];
  transition_duration: number;
  preview_locked: boolean;
  scaling_enabled: boolean;
  scaling_level: number;
  scaling_off_x: number;
  scaling_off_y: number;
  modules: Record<string, never>;
};

type ObsSource = {
  prev_ver: number;
  name: string;
  uuid: string;
  id: string;
  versioned_id: string;
  settings: Record<string, unknown>;
  mixers: number;
  sync: number;
  flags: number;
  volume: number;
  balance: number;
  enabled: boolean;
  muted: boolean;
  "push-to-mute": boolean;
  "push-to-talk": boolean;
  hotkeys: Record<string, never>;
  deinterlace_mode: number;
  deinterlace_field_order: number;
  monitoring_type: number;
  private_settings: Record<string, never>;
};

function sourceShell(input: {
  name: string;
  uuid: string;
  id: string;
  settings: Record<string, unknown>;
  mixers: number;
  muted: boolean;
}): ObsSource {
  return {
    prev_ver: OBS_PREV_VER,
    name: input.name,
    uuid: input.uuid,
    id: input.id,
    versioned_id: input.id,
    settings: input.settings,
    mixers: input.mixers,
    sync: 0,
    flags: 0,
    volume: 1,
    balance: 0.5,
    enabled: true,
    muted: input.muted,
    "push-to-mute": false,
    "push-to-talk": false,
    hotkeys: {},
    deinterlace_mode: 0,
    deinterlace_field_order: 0,
    monitoring_type: 0,
    private_settings: {},
  };
}

/**
 * Scene collection OBS imports via Scene Collection → Import.
 * Version 1 keeps item positions in absolute pixels (no canvas migration).
 * The browser source viewport is the wall size; the scene item is locked to that box.
 */
export function buildTriviaObsSceneCollection(input: {
  url: string;
  sceneUuid?: string;
  sourceUuid?: string;
}): TriviaObsSceneCollection {
  const sceneUuid = input.sceneUuid ?? crypto.randomUUID();
  const sourceUuid = input.sourceUuid ?? crypto.randomUUID();
  const bounds: ObsVec2 = { x: TRIVIA_WALL_WIDTH, y: TRIVIA_WALL_HEIGHT };

  const scene = sourceShell({
    name: TRIVIA_OBS_SCENE_NAME,
    uuid: sceneUuid,
    id: "scene",
    mixers: 0,
    muted: false,
    settings: {
      id_counter: 1,
      custom_size: false,
      items: [
        {
          name: TRIVIA_OBS_BROWSER_SOURCE_NAME,
          source_uuid: sourceUuid,
          visible: true,
          locked: true,
          rot: 0,
          pos: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          align: 5,
          bounds_type: 2,
          bounds_align: 0,
          bounds,
          crop_left: 0,
          crop_top: 0,
          crop_right: 0,
          crop_bottom: 0,
          id: 1,
          group_item_backup: false,
          scale_filter: "disable",
          blend_method: "default",
          blend_type: "normal",
          show_transition: { duration: 300 },
          hide_transition: { duration: 300 },
          private_settings: {},
        },
      ],
    },
  });

  const browser = sourceShell({
    name: TRIVIA_OBS_BROWSER_SOURCE_NAME,
    uuid: sourceUuid,
    id: "browser_source",
    mixers: 255,
    muted: true,
    settings: {
      is_local_file: false,
      local_file: "",
      url: input.url,
      width: TRIVIA_WALL_WIDTH,
      height: TRIVIA_WALL_HEIGHT,
      fps_custom: true,
      fps: 30,
      css: "body { background-color: rgba(0, 0, 0, 1); margin: 0px auto; overflow: hidden; }",
      shutdown: false,
      restart_when_active: false,
      webpage_control_level: 0,
      reroute_audio: false,
    },
  });

  return {
    name: TRIVIA_OBS_COLLECTION_NAME,
    version: OBS_COLLECTION_VERSION,
    current_scene: TRIVIA_OBS_SCENE_NAME,
    current_program_scene: TRIVIA_OBS_SCENE_NAME,
    scene_order: [{ name: TRIVIA_OBS_SCENE_NAME }],
    sources: [scene, browser],
    groups: [],
    transitions: [],
    transition_duration: 300,
    preview_locked: false,
    scaling_enabled: false,
    scaling_level: 0,
    scaling_off_x: 0,
    scaling_off_y: 0,
    modules: {},
  };
}
