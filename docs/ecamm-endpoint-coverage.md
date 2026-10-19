# Ecamm Live Remote Control — endpoint coverage

This document enumerates every endpoint verified from the official Ecamm Live Remote API specification and the maintained Companion reference client. It does **not** invent endpoints beyond those sources.

## Reference versions

| Item | Value |
| --- | --- |
| Official API document | Ecamm Live Remote API v4.4 (`docs/ecamm-live-remote-api-v4.4.md` in Companion repo) |
| Companion module | `bitfocus/companion-module-ecamm-live@4.0.1` |
| Commit SHA | `4f8d7e09e0940e576d6b637723065ee34df1f84a` |
| FloBama client identity | `FloBama OS` (User-Agent + EcammLive-ClientName) |
| Transport | HTTP GET; actions return plain text `Done`; reads return JSON |
| Query encoding | `encodeURIComponent` (spaces as `%20`, not `+`) |
| getInfo poll floor | 2000 ms |

## Coverage summary

| Metric | Count |
| --- | --- |
| Total verified endpoints | 70 |
| Read endpoints | 28 |
| Action/toggle endpoints | 42 |
| Status: diagnostics_only | 5 |
| Status: hardware_unverified | 42 |
| Status: implemented | 23 |

## Honesty notes

- Official documentation is the Ecamm v4.4 Remote API markdown mirrored in the Companion repository.
- Companion implements most list endpoints via `*List` forms. Official `*Dict` and image endpoints are included even when Companion omits first-class client methods.
- Per-bus `setMute` / `getMute?bus=` is **Companion-observed / undocumented** and requires `allow_per_bus_mute` after venue-Mac testing. Global mute remains documented.
- Action endpoints that mutate show state are marked `hardware_unverified` until exercised on the venue Mac. Automated tests use mocked protocol fixtures only.
- Recording/broadcast state is inferred from button labels only.
- Default camera ≠ live camera. PIP / playing-sound / current-profile identities are not reported.

## Endpoint table

| Endpoint | Method | Kind | Parameters | Response | Source | Adapter | UI / background | Permission | Observable state | Limitations | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| getConnectionStatus | GET | read | none | JSON scalar array → "Allowed" \\| "Denied" \\| "Pending" \\| "Not Found" | official_v4_4 | getConnectionStatus | Devices & Diagnostics; connection gate | viewer_read | approvalPermission | Must be checked before other calls; Denied must not re-prompt. | implemented |
| getInfo | GET | read | none | JSON object: ButtonLabel, PauseButtonLabel, CurrentScene, Viewers, Mute, volumes, Zoom fields… | official_v4_4 | getInfo | Background poll (≥2s); Overview status strip | background | info (+ unmappedKeys preserved) | Do not poll faster than 2 seconds. Empty {} when unapproved. | implemented |
| getButtonLabel | GET | read | none | JSON [string] start/record button label | official_v4_4 | getButtonLabel | Overview broadcast control label; Diagnostics | viewer_read | buttonLabel | Recording/live state is inferred from label wording only. | implemented |
| getPauseButtonLabel | GET | read | none | JSON [string] pause button label | official_v4_4 | getPauseButtonLabel | Overview pause control label | viewer_read | pauseButtonLabel | Same inference caveats as getButtonLabel. | implemented |
| getViewers | GET | read | none | JSON [string] concurrent viewers | official_v4_4 | getViewers | Overview; Diagnostics | viewer_read | viewers | Also present on getInfo. | implemented |
| getLiveDemo | GET | read | none | JSON [string] "yes"\\|"no" | official_v4_4 | getLiveDemo | Advanced utilities; Diagnostics | viewer_read | liveDemo | Also on getInfo. | implemented |
| getHideShowUI | GET | read | none | JSON [string] "yes"\\|"no" on-screen button visibility | official_v4_4 | getHideShowUI | Advanced utilities; Diagnostics | viewer_read | hidingUi | Also on getInfo as HidingUI. | implemented |
| getMute | GET | read | bus? (official: omit for global; Companion-observed: same bus ids as volume) | JSON [string] "yes"\\|"no" | both | getMute | Audio; Diagnostics | viewer_read | mute / bus mute | Per-bus bus= is undocumented. Absent buses answer "no", so cannot distinguish unmuted from unavailable. | implemented |
| getSceneList | GET | read | none | JSON {items: Scene[]} (or array); groups have Group+Children | official_v4_4 | getSceneList | Scenes & Sources grid | viewer_read | scenes | Groups are not switchable; children are flattened for the UI. | implemented |
| getSceneDict | GET | read | none | JSON dictionary of scenes | official_v4_4 | getSceneDict | Diagnostics (dict form) | admin_diagnostics | raw scene dict | Not used by Companion client; available for diagnostics. | diagnostics_only |
| getSceneImage | GET | read | id (scene UUID) | JSON {icon: base64 JPG} | official_v4_4 | getSceneImage | Scenes snapshot (timestamped); Diagnostics | manager_control | scene thumbnail (stamped) | Last thumbnail, not a continuous live preview transport. | implemented |
| getOverlayList | GET | read | none | JSON overlays for CURRENT scene only | official_v4_4 | getOverlayList | Graphics & Comments | viewer_read | overlays (scene-scoped) | Cannot report overlays for non-live scenes. | implemented |
| getOverlayDict | GET | read | none | JSON dictionary of overlays | official_v4_4 | getOverlayDict | Diagnostics | admin_diagnostics | raw overlay dict | Still current-scene only. | diagnostics_only |
| getOverlayImage | GET | read | id (overlay UUID) | JSON {icon: base64 JPG} | official_v4_4 | getOverlayImage | Graphics snapshot; Diagnostics | manager_control | overlay thumbnail (stamped) | Snapshot only. | implemented |
| getInputs | GET | read | none | JSON camera/input list (ids are NOT always UUIDs) | official_v4_4 | getInputs | Scenes & Sources camera selector | viewer_read | inputs | Does not identify which camera is live. | implemented |
| getVideoList | GET | read | none | JSON recent videos; may include empty placeholder | official_v4_4 | getVideoList | Scenes & Sources video selector | viewer_read | videos | Placeholder "-No recent items-" filtered out. | implemented |
| getVideoDict | GET | read | none | JSON dictionary of videos | official_v4_4 | getVideoDict | Diagnostics | admin_diagnostics | raw video dict | None beyond list form. | diagnostics_only |
| getVideoImage | GET | read | id (file path) | JSON {icon: base64 JPG} | official_v4_4 | getVideoImage | Scenes video snapshot; Diagnostics | manager_control | video thumbnail (stamped) | Snapshot only. | implemented |
| getSoundList | GET | read | none | JSON sounds + folders (Group+Children) | official_v4_4 | getSoundList | Audio soundboard | viewer_read | sounds, soundFolders | Which sound is playing is not reported by the API. | implemented |
| getSoundDict | GET | read | none | JSON dictionary of sounds | official_v4_4 | getSoundDict | Diagnostics | admin_diagnostics | raw sound dict | None beyond list form. | diagnostics_only |
| getAudioFilterList | GET | read | none | JSON audio filters | official_v4_4 | getAudioFilterList | Audio filters | viewer_read | audioFilters | Active filter identity not separately reported. | implemented |
| getAudioFilterDict | GET | read | none | JSON dictionary of filters | official_v4_4 | getAudioFilterDict | Diagnostics | admin_diagnostics | raw filter dict | None beyond list form. | diagnostics_only |
| getProfileList | GET | read | none | JSON profiles | official_v4_4 | getProfileList | Scenes & Sources profiles | viewer_read | profiles | Current profile identity is not reported by the API. | implemented |
| getChannels | GET | read | none | JSON dictionary/list of streaming destinations | official_v4_4 | getChannels | Overview broadcast channel picker | viewer_read | channels | Documented as dictionary; live installs may use {items}. | implemented |
| getCurrentScene | GET | read | none | JSON [UUID] | official_v4_4 | getCurrentScene | Status strip; scene confirm after switch | viewer_read | currentSceneId | Also on getInfo; used for race-safe overlay refresh. | implemented |
| getCurrentMode | GET | read | none | JSON [string] cam\\|screen\\|video (blank observed) | official_v4_4 | getCurrentMode | Scenes source mode | viewer_read | currentMode | "blank" observed live; passed through. | implemented |
| getDefaultCamera | GET | read | none | JSON [id] default camera — NOT live camera | official_v4_4 | getDefaultCamera | Scenes; labeled as default, not live | viewer_read | defaultCameraId | API cannot report which camera is live. | implemented |
| getVolume | GET | read | bus (mic\\|mic2\\|skype\\|system audio\\|interview\\|zoom\\|soundeffects\\|movie\\|guest_1..4) | JSON [string] numeric or "N/A" | official_v4_4 | getVolume | Audio sliders; Diagnostics | viewer_read | volumes[bus] or unavailable | Unavailable buses are N/A — never treat as 0. | implemented |
| setClickButton | GET | action | channel?, title?, desc? | plain text "Done" | official_v4_4 | setClickButton | Overview Start/Stop (uses live button label) | manager_control | buttonLabel after refresh (not assumed) | Toggle semantics via button label; do not auto-replay after timeout. | hardware_unverified |
| setClickPauseButton | GET | toggle | none | plain text "Done" | official_v4_4 | setClickPauseButton | Overview Pause/Resume | manager_control | pauseButtonLabel after refresh | Toggle; uncertain on timeout. | hardware_unverified |
| setStartNewRecording | GET | action | none | plain text "Done" | official_v4_4 | setStartNewRecording | Overview New recording | manager_control | session + button label | Only while already streaming/recording per doc. | hardware_unverified |
| setComment | GET | action | text | plain text "Done" | official_v4_4 | setComment | Graphics & Comments | manager_control | ack only | Posts to Twitch/YouTube/Facebook Pages destinations. | hardware_unverified |
| setShowComment | GET | action | none | plain text "Done" | official_v4_4 | setShowComment | Graphics & Comments | manager_control | comment overlay visibility if listed | Shows most recent comment overlay. | hardware_unverified |
| setHideComment | GET | action | none | plain text "Done" | official_v4_4 | setHideComment | Graphics & Comments | manager_control | comment overlay visibility if listed | Hides most recent comment overlay. | hardware_unverified |
| setMarker | GET | action | text?, dialogbox true\\|false | plain text "Done" | official_v4_4 | setMarker | Overview Mark Highlight; Recordings timeline | manager_control | OS marker always; Ecamm confirm separate | Marker ≠ rendered clip. Dialog behavior venue-Mac unverified. | hardware_unverified |
| setScene | GET | action | id | plain text "Done" | official_v4_4 | setScene | Scenes grid | manager_control | currentSceneId after confirm poll | Async ~400ms; overlays refreshed only after confirm. | hardware_unverified |
| setNext | GET | action | none | plain text "Done" | official_v4_4 | setNext | Scenes next | manager_control | currentSceneId | Same async overlay race rules. | hardware_unverified |
| setPrev | GET | action | none | plain text "Done" | official_v4_4 | setPrev | Scenes previous | manager_control | currentSceneId | Same async overlay race rules. | hardware_unverified |
| setInput | GET | action | id | plain text "Done" | official_v4_4 | setInput | Scenes camera selector | manager_control | ack; live camera unknown | Cannot confirm live camera identity. | hardware_unverified |
| setMode | GET | action | mode cam\\|screen\\|video | plain text "Done" | official_v4_4 | setMode | Scenes source mode | manager_control | currentMode | blank mode observed on reads; set uses documented trio. | hardware_unverified |
| setVideo | GET | action | id (file path) | plain text "Done" | official_v4_4 | setVideo | Scenes video selector | manager_control | ack | Path must be valid on the Mac. | hardware_unverified |
| setPIP | GET | toggle | none | plain text "Done" | official_v4_4 | setPIP | Scenes PIP (labeled toggle) | manager_control | none — API has no PIP status | Toggle with no matching status. | hardware_unverified |
| setOverlay | GET | toggle | id | plain text "Done" | official_v4_4 | setOverlay | Graphics overlays | manager_control | overlay.Visible for current scene only | Visibility unknown for non-live scenes. | hardware_unverified |
| setMute | GET | toggle | bus? (omit = global; bus = undocumented per-bus) | plain text "Done" | both | setMute | Audio mute toggles (per-bus gated) | manager_control | Mute / MUTE_* from getInfo | Global mute is documented. Per-bus bus= is Companion-observed/undocumented and must be venue-gated (allow_per_bus_mute). | hardware_unverified |
| setVolume | GET | action | bus, volume | plain text "Done" | official_v4_4 | setVolume | Audio sliders (debounced) | manager_control | VOLUME_* from getInfo | Not a live level meter. Separate from LED playback volume. | hardware_unverified |
| setAudioFilter | GET | toggle | id | plain text "Done" | official_v4_4 | setAudioFilter | Audio filters | manager_control | ack only | Toggle; active filter not reported. | hardware_unverified |
| setSound | GET | action | id, volume 0-100, action stop\\|loop\\|restart | plain text "Done" | official_v4_4 | setSound | Audio soundboard | manager_control | ack only | Playing sound identity not reported. | hardware_unverified |
| setSoundVolume | GET | action | volume 0-100 | plain text "Done" | official_v4_4 | setSoundVolume | Audio sound volume | manager_control | ack | Applies to currently playing sound. | hardware_unverified |
| setSoundStop | GET | action | none | plain text "Done" | official_v4_4 | setSoundStop | Audio stop sound | manager_control | ack | None. | hardware_unverified |
| setSoundPause | GET | toggle | none | plain text "Done" | official_v4_4 | setSoundPause | Audio pause sound | manager_control | ack | Pause/resume toggle of current sound. | hardware_unverified |
| setPreviewMode | GET | toggle | none | plain text "Done" | official_v4_4 | setPreviewMode | Scenes preview mode | manager_control | PreviewMode from getInfo | Does not imply browser video preview availability. | hardware_unverified |
| setPublish | GET | action | none | plain text "Done" | official_v4_4 | setPublish | Scenes publish preview | manager_control | ack + PreviewMode | Do not auto-replay after timeout. | hardware_unverified |
| setProfile | GET | action | id | plain text "Done" | official_v4_4 | setProfile | Scenes profiles | manager_control | lists invalidated/reloaded | Current profile not reported; dependent lists must reload. | hardware_unverified |
| setLiveDemo | GET | toggle | none | plain text "Done" | official_v4_4 | setLiveDemo | Advanced utilities | admin_setup | LiveDemo | Less-used utility. | hardware_unverified |
| setHideShowUI | GET | toggle | none | plain text "Done" | official_v4_4 | setHideShowUI | Advanced utilities | admin_setup | HidingUI | Less-used utility. | hardware_unverified |
| setZoomNew | GET | action | pmi true\\|false (default true) | plain text "Done" | official_v4_4 | setZoomNew | Zoom — meeting create | manager_control | ZoomInMeeting after refresh | Requires Ecamm for Zoom. Capability-gated. | hardware_unverified |
| setZoomLeave | GET | action | end true\\|false (default true; host only) | plain text "Done" | official_v4_4 | setZoomLeave | Zoom — leave/end (confirm required) | manager_control | ZoomInMeeting | Ending for everyone requires explicit confirmation. No auto-replay. | hardware_unverified |
| setZoomPanel | GET | toggle | panel meeting\\|chat\\|participants\\|share | plain text "Done" | official_v4_4 | setZoomPanel | Zoom panels | manager_control | ack only | Panel visibility not reported. | hardware_unverified |
| setZoomVideo | GET | toggle | none | plain text "Done" | official_v4_4 | setZoomVideo | Zoom camera | manager_control | ZoomCamOn | In-meeting only. | hardware_unverified |
| setZoomAudio | GET | toggle | none | plain text "Done" | official_v4_4 | setZoomAudio | Zoom mic | manager_control | ZoomMuted | In-meeting only. | hardware_unverified |
| setZoomMuteAll | GET | action | none | plain text "Done" | official_v4_4 | setZoomMuteAll | Zoom mute all (confirm) | manager_control | ack | Host/co-host only. | hardware_unverified |
| setZoomRaiseHand | GET | toggle | none | plain text "Done" | official_v4_4 | setZoomRaiseHand | Zoom raise hand | manager_control | ZoomHandRaised | In-meeting only. | hardware_unverified |
| setZoomFullScreen | GET | toggle | none | plain text "Done" | official_v4_4 | setZoomFullScreen | Zoom full screen | manager_control | ack | Fullscreen state not reported. | hardware_unverified |
| setZoomCloudRecord | GET | toggle | none | plain text "Done" | official_v4_4 | setZoomCloudRecord | Zoom cloud recording | manager_control | ZoomCloudRecording | In-meeting only. | hardware_unverified |
| setZoomLocalRecord | GET | toggle | none | plain text "Done" | official_v4_4 | setZoomLocalRecord | Zoom local recording | manager_control | ZoomLocalRecording | In-meeting only. | hardware_unverified |
| setZoomPauseRecord | GET | toggle | none | plain text "Done" | official_v4_4 | setZoomPauseRecord | Zoom pause recording | manager_control | ZoomRecordingPaused | In-meeting only. | hardware_unverified |
| setZoomPrevGallery | GET | action | none | plain text "Done" | official_v4_4 | setZoomPrevGallery | Zoom gallery nav | manager_control | ack | Gallery page not reported. | hardware_unverified |
| setZoomNextGallery | GET | action | none | plain text "Done" | official_v4_4 | setZoomNextGallery | Zoom gallery nav | manager_control | ack | Gallery page not reported. | hardware_unverified |
| setZoomGallerySpeaker | GET | toggle | none | plain text "Done" | official_v4_4 | setZoomGallerySpeaker | Zoom gallery/speaker | manager_control | ack | View mode not reported. | hardware_unverified |
| setSpotlightSelf | GET | toggle | none | plain text "Done" | official_v4_4 | setSpotlightSelf | Zoom spotlight | manager_control | ack | Spotlight state not reported. | hardware_unverified |

## Architecture (FloBama)

Authenticated Production UI → FloBama OS command API → paired Local Runner on the selected Mac → Ecamm local Remote Control API.

The browser and Vercel never connect directly to Ecamm’s private network address.

## Related docs

- [Mac setup](./production-ecamm-mac-setup.md)
- [Shortcuts](./production-ecamm-shortcuts.md)
- [Venue checklist](./production-ecamm-venue-checklist.md)
