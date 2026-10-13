# Bandwidth Optimization Plan

**Status:** Planning document. Distinguishes **measured** organization facts from **estimated** scenario math.  
**Target:** Keep View 360 Marketing organization monthly **cached egress ≤ 75 GB** with headroom (org allowance historically 275 GB).

---

## 1. Root-cause summary

### 1.1 Measured (from ops investigation / user report)

| Fact | Value |
|------|-------|
| Organization | View 360 Marketing |
| Project | FloBama OS (`ytlggwdblolmcuccqrqn`) |
| Cached egress | **395.14 GB** vs **275 GB** allowance |
| Primary bucket | `screen-ads` |
| Stored media size | **~2.24 GB** |
| OBS-related transfer (inspected window) | **~115 GB** |
| Two MP4s (inspected window) | **~119 GB** combined outbound |
| Edge log volume (inspected window) | **>1.5M** records |
| Dominant response class | HTTP **206** Partial Content |

### 1.2 Confirmed code behavior amplifying egress

1. OBS Browser Source loads hosted `/display/led`, which sets `<video src="{public Supabase URL}">`.
2. Vertical browsers do the same via `/display/vertical`.
3. Looping / seeking / remounting triggers repeated Range requests against Supabase Storage CDN (cached egress still counts against allowance).
4. Vertical full `location.reload()` on playlist revision / takeover end / staff reload nonce forces fresh media fetches.
5. LED display polls JSON every 1s (small) but keeps media on the hot path continuously.
6. `clients/led-obs` polls sync every 1s — **not** a media downloader; not the bulk byte source.

### 1.3 Amplification intuition

If a 50 MB loop is watched for hours via remote streaming with poor cache reuse on Range requests, monthly transfer can be **orders of magnitude** larger than the bytes stored. That matches 2.24 GB stored → hundreds of GB egress.

---

## 2. Optimization strategy (controls)

| # | Control | Effect |
|---|---------|--------|
| 1 | Download media when first assigned | Seed cost ≈ library size × devices |
| 2 | Local cache for repeated playback | Steady-state Storage egress ≈ 0 for plays |
| 3 | Content-hash identity | Scene switches do not re-download |
| 4 | Persist cache across restarts | No daily re-seed |
| 5 | Download only on hash/version change | Churn-proportional egress |
| 6 | Backoff + budget on retries | Prevent 5xx retry storms |
| 7 | Revision/ETag sync | Cut JSON/DB chatter |
| 8 | Transfer metrics on grants/downloads | Measurable |
| 9 | Configurable daily bandwidth budget | Hard ceiling per venue/org |
| 10 | Alerts on unexpected transfer | Catch regressions early |

**Non-goals that still help:** encouraging lower bitrates for new uploads; avoiding unnecessary staff “Refresh wall displays” during shows; keeping public `/display/*` offline once local players are live.

---

## 3. Scenario estimates

### 3.1 Shared assumptions (stated explicitly)

| Assumption | Value | Type |
|------------|-------|------|
| Library size in `screen-ads` | 2.24 GB | **Measured** (approx) |
| Devices | 1 LED Mac + 2 vertical kiosks | Venue inventory |
| Monthly content churn | 20% of library replaced | **Estimated** |
| Control-plane HTTPS (APIs) | 2–5 GB/month all devices | **Estimated** |
| Other projects on same org | Unknown | **Must measure** in Supabase org dashboard |
| Admin UI thumbnail traffic | 1–3 GB/month | **Estimated** |
| Hash backfill one-time | ~2.24 GB (+ overhead) | **Estimated** one-time |
| Signed URL download overhead | ~5–10% vs raw size | **Estimated** |

Formula used below:

```text
monthly_media ≈ devices × library_seed_first_month_or_0
              + devices × (churn_fraction × library)
              + control_plane + admin_previews + other_projects
```

After first month, seed is 0 if caches persist.

### 3.2 Scenario A — Current remote-streaming (status quo)

| Component | Estimate |
|-----------|----------|
| LED OBS looping remote MP4s | Dominant; can be **100–400+ GB/month** depending on hours/bitrate/cache behavior |
| Two verticals remote streaming | Additional tens–hundreds GB if 16h/day loops |
| APIs / other | Small vs media |
| **Total** | **~395 GB measured** recently; order-of-hundreds GB expected without change |

### 3.3 Scenario B — Local cache for OBS only

| Component | Month 1 | Steady month |
|-----------|---------|--------------|
| LED seed download | ~2.24 GB | 0 |
| LED churn 20% | ~0.45 GB | ~0.45 GB |
| Verticals still remote | **High (unknown)** — still risk overage | same |
| Control + admin | ~5 GB | ~5 GB |
| **FloBama media (LED path)** | **~8 GB** | **~6 GB** |
| **Org total** | Still unsafe if verticals stream | Unsafe |

**Verdict:** Necessary but **not sufficient** alone for a 75 GB org target if verticals keep streaming.

### 3.4 Scenario C — Local cache for OBS + both verticals

| Component | Month 1 | Steady month |
|-----------|---------|--------------|
| Seed × 3 devices | ~6.7 GB | 0 |
| Churn 20% × 3 | ~1.3 GB | ~1.3 GB |
| Control + admin | ~5 GB | ~5 GB |
| One-time hash backfill | ~2.5 GB (month of rollout) | 0 |
| **FloBama display media subtotal** | **~15–16 GB** | **~6–8 GB** |

**Verdict:** Comfortably under **75 GB** for FloBama display traffic **if** caches work and churn stays modest. Leaves headroom for other org projects — **only if those projects are measured and bounded**.

### 3.5 Scenario D — Scenario C + reduced bitrates

Assume new uploads average **40% smaller** encoded size over time:

| Steady month FloBama display | ~4–6 GB estimated |
|------------------------------|-------------------|

Improves headroom; does not replace caching.

### 3.6 Sensitivity

| If churn is 100%/month | 3 × 2.24 ≈ 6.7 GB media + control ≈ **12 GB** — still fine |
| If someone points OBS back at hosted `/display/led` | Regression toward Scenario A within days |
| If retry storm on 5xx | Can spike; must enforce backoff + budget |
| If other org projects use 50+ GB | FloBama must stay lower; alerts must be **org-level** |

---

## 4. Plan to hit ≤ 75 GB org cached egress

### 4.1 FloBama envelope

Reserve **≤ 25 GB/month** FloBama cached egress as an internal soft budget (media downloads + previews + backfill amortized), leaving **≥ 50 GB** for other View 360 projects and spikes — total target **≤ 75 GB** org-wide.

### 4.2 Implementation controls

1. Ship Local Runner + Vertical Player (Scenarios C/D).
2. Disable production Browser Sources from hosted media URLs post-cutover.
3. Device download budget: e.g. 3 GB/day/venue default; alert at 80%.
4. Exponential backoff; no unbounded parallel Range retries against Storage.
5. Prefer signed, cacheable full-file downloads (single GET) over players issuing tiny Ranges to Storage.
6. Staff UI warning when “Refresh wall displays” would reload **hosted** players still in use.
7. Weekly review of Supabase org cached egress during Stages 5–6.

### 4.3 Monitoring & alerts

| Signal | Source | Action |
|--------|--------|--------|
| Org cached egress MTD | Supabase dashboard / billing API if available | Alert at 40 / 60 / 75 GB |
| Per-venue download bytes | `display_device` metrics from grant/download completions | Alert on budget |
| 206 rate to `screen-ads` from OBS UA | Edge logs sample | Detect regression to remote streaming |
| 5xx on sync/download | App logs | Confirm backoff engaged |
| Device cache hit ratio | Runner/APK status | Investigate forced re-downloads |

Exportable metrics fields (from API contract): bytes downloaded, bytes served locally (Mac), failed downloads, revision age.

---

## 5. Cost-reduction sequence (priority)

1. **Stop continuous OBS remote streaming** (Local Runner Option A) — largest win.
2. **Stop continuous vertical remote streaming** (APK cache).
3. **Revision-based sync** — reduce API/DB load and 5xx amplification risk.
4. **Hash + skip unchanged** — control churn cost.
5. **Encode guidance** — lower bitrate templates for LED loops / vertical ads.
6. **Optional:** move bucket to non-public + signed-only after all players migrated (security + accidental hotlinking protection).

---

## 6. Acceptance metrics

Migration Stage 6 is green when:

1. Week-over-week Supabase cached egress trends **down sharply** after LED cutover.
2. After both kiosks cut over, FloBama Storage egress for playback is **download/churn shaped**, not **hours-played × bitrate** shaped.
3. Org MTD egress projected **≤ 75 GB** (or documented exception with other-project attribution).
4. No multi-day OBS UA Range storms against `screen-ads` in edge logs.

---

## 7. Open measurement tasks (runtime)

These are hypotheses until verified in Supabase:

1. Break down org egress by project (FloBama vs others).
2. Confirm fraction of egress that is cached vs uncached.
3. Identify any non-display heavy consumers (backups, other apps).
4. Capture baseline week of edge logs after Local Runner shadow mode (should show downloads, not continuous 206 play).
