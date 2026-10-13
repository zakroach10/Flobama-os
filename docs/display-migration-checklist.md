# Display Migration Checklist

**Status:** Operational runbook for staged rollout.  
**Constraint:** Live music venue — minimize downtime; every stage has rollback.  
**Architecture:** [local-media-architecture.md](./local-media-architecture.md)

---

## Preconditions (before Stage 1)

- [ ] Architecture docs reviewed and approved
- [ ] Supabase org egress baseline screenshot/export saved (MTD + last full month)
- [ ] Booth Mac: OBS version, scene list, current Browser Source URL documented
- [ ] Vertical kiosk A/B: Android version, storage free, how they open `/display/vertical` today documented
- [ ] Staff contacts for show-night abort authority identified
- [ ] Hosted `/display/led` and `/display/vertical` confirmed working (rollback targets)

---

## Stage 1 — Parallel testing

**Goal:** Run Local Runner beside production without changing the live program output.

### Steps

1. Install Local Runner on booth Mac (LaunchAgent + menu bar).
2. Pair / configure with staging or production API as approved.
3. Confirm cache downloads assigned LED assets to `/Users/Shared/FloBamaOS/media/`.
4. Confirm `http://127.0.0.1:4173/health` and `/status` OK.
5. Open `http://127.0.0.1:4173/wall` in a normal browser on the Mac (not OBS program).
6. Keep production OBS Browser Source on hosted `/display/led`.

### Acceptance

- [ ] Runner survives reboot (LaunchAgent)
- [ ] Menu bar shows connected
- [ ] Cache reaches 100% for current playlist without errors
- [ ] Local `/wall` shows correct playlist timing vs hosted (compare side-by-side)
- [ ] Production LED wall **unchanged**

### Rollback

- Stop LaunchAgent / quit app; delete config if needed.
- No OBS changes required.

---

## Stage 2 — Shadow playback

**Goal:** Validate in a **non-program** OBS scene.

### Steps

1. Create OBS scene e.g. `FloBama Local Shadow` (not in normal show rotation).
2. Add Browser Source → `http://127.0.0.1:4173/wall` at wall resolution.
3. Preview shadow scene while production continues on hosted URL.
4. Exercise: playlist activate, scene cut via FloBama, media upload + wait for cache, trivia/audience overlay if applicable.
5. Confirm agent still cuts **production** scenes correctly.

### Acceptance

- [ ] Shadow matches hosted content within expected timing skew
- [ ] New upload appears on shadow after download without editing OBS paths
- [ ] Seeking/looping on shadow generates **no** new Supabase play traffic for that asset (verify via status / optional log sampling)
- [ ] Runner reconnects after deliberate Wi-Fi toggle; shadow continues last-known-good

### Rollback

- Remove or disable shadow scene.
- Leave production Browser Source untouched.

---

## Stage 3 — LED wall cutover

**Goal:** Move **one** production display source to local playback.

### Steps

1. Schedule during non-critical window (not mid-headliner).
2. Confirm cache 100% + shadow parity within last 15 minutes.
3. Change production media Browser Source URL from `{origin}/display/led` → `http://127.0.0.1:4173/wall`.
4. Soft refresh Browser Source; confirm program output.
5. Monitor for 1–2 full playlist cycles + one staff-activated scene change.
6. Watch menu bar + Screens device status.

### Acceptance

- [ ] Program LED shows correct media
- [ ] OBS scene switching from FloBama still works
- [ ] Trivia/audience overlays behave acceptably
- [ ] No blank wall lasting > N seconds (agree N, e.g. 3s) on playlist boundaries
- [ ] Runner logs clean of download storms

### Rollback (LED)

1. Set Browser Source URL back to `{origin}/display/led`.
2. Refresh Browser Source.
3. Confirm hosted player live.
4. Leave Local Runner running or stop — either is safe for rollback of video path.

**Abort authority:** Booth lead may roll back immediately without waiting for engineering if wall goes dark during a show.

---

## Stage 4 — Android pilot (one kiosk)

**Goal:** One vertical kiosk on APK with cache + offline test.

### Steps

1. Install APK on Kiosk A; pair to venue; label clearly.
2. Allow full playlist + takeover assets to download; confirm Screens shows ready.
3. Switch kiosk from browser `/display/vertical` to APK player.
4. Tests: playlist loop, takeover start/end, airplane mode / unplug WAN for 30+ minutes, reboot, force-stop recovery.
5. Keep Kiosk B on hosted browser.

### Acceptance

- [ ] Picture matches prior browser playlist
- [ ] Offline continues last-known-good
- [ ] Takeover works end-to-end
- [ ] Reboot auto-starts player (within OEM limits)
- [ ] Device shows online in Screens; download progress accurate

### Rollback (Kiosk A)

- Open previous browser/WebView to `{origin}/display/vertical`.
- Optionally revoke device token after confirm.

---

## Stage 5 — Full deployment

**Goal:** All remaining screen playback on local-first architecture.

### Steps

1. Cut over Kiosk B using Stage 4 checklist.
2. Confirm both kiosks + LED runner healthy for a full business day.
3. Document final OBS URLs and APK versions in venue runbook.
4. Optionally hide/disable staff paths that encourage hosted display use on these devices.
5. Keep hosted `/display/*` available for emergency.

### Acceptance

- [ ] LED + both verticals on local playback
- [ ] No booth Mac Terminal dependency
- [ ] Pairing/revoke documented for staff
- [ ] Emergency rollback steps posted at booth

### Rollback

- Per-device: revert LED Browser Source and/or kiosk browser URL as in Stages 3–4.
- Can roll devices independently.

---

## Stage 6 — Monitoring

**Goal:** Prove egress drop while playback stays stable.

### Steps

1. Compare Supabase org cached egress MTD vs pre-cutover baseline (daily for 2 weeks).
2. Sample edge logs for OBS UA / vertical traffic to `screen-ads` — expect downloads, not continuous 206 play.
3. Review device error reports and disk alerts.
4. Confirm bandwidth budgets/alerts armed ([bandwidth-optimization-plan.md](./bandwidth-optimization-plan.md)).
5. Hold go/no-go on making bucket private / signed-only (follow-on).

### Acceptance

- [ ] Egress trend consistent with Scenario C/D estimates (not Scenario A)
- [ ] Projected org month ≤ **75 GB** or unexplained remainder attributed to other projects with owners
- [ ] No show-stopping player incidents open
- [ ] Retrospective notes filed; roadmap follow-ups prioritized

### Rollback

- Not typically “roll back monitoring”; if egress regresses, inspect whether a Browser Source reverted to hosted URL and fix forward.

---

## Production acceptance criteria (global)

1. Remote scene switching and playlist admin unchanged for staff.
2. Operators never manually retarget OBS media file paths after uploads.
3. Unavailable Supabase does not blank an already-warmed LED wall or kiosk.
4. Lost device can be revoked.
5. Local Runner and APK start after power loss without engineer on site (within platform limits).
6. Documented rollback tested once before each production cutover stage.

---

## Show-night emergency card (print)

```text
LED DARK?
1) OBS → media Browser Source URL → https://<flobama-host>/display/led
2) Refresh browser source
3) Call: ____________________

KIOSK STUCK?
1) Open browser to https://<flobama-host>/display/vertical
2) Or reboot kiosk once
3) Call: ____________________
```
