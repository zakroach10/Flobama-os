# FloBama OS documentation

## Local media architecture (planning)

Planning set for FloBama Local Runner (macOS) and Vertical Player (Android) to eliminate continuous Supabase Storage streaming while preserving OBS and Screens admin workflows.

| Document | Description |
|----------|-------------|
| [local-media-architecture.md](./local-media-architecture.md) | System design, audit findings, Option A playback, cache layout, fallbacks |
| [mac-local-runner-plan.md](./mac-local-runner-plan.md) | Mac runner components, localhost HTTP, OBS cutover, packaging |
| [android-vertical-player-plan.md](./android-vertical-player-plan.md) | ExoPlayer APK, pairing, offline cache, kiosk capability matrix |
| [media-sync-api-contract.md](./media-sync-api-contract.md) | Device auth, manifests, download grants, errors |
| [bandwidth-optimization-plan.md](./bandwidth-optimization-plan.md) | Root cause, traffic estimates, ≤75 GB org target, monitoring |
| [display-migration-checklist.md](./display-migration-checklist.md) | Stages 1–6, acceptance criteria, rollback |
| [local-media-implementation-roadmap.md](./local-media-implementation-roadmap.md) | Stack, folders, DB, phases, Cursor task list, tests |

**Start here for implementation:** [local-media-implementation-roadmap.md](./local-media-implementation-roadmap.md)

---

## Product overview PDF

- **[flobama-os-v1.pdf](./flobama-os-v1.pdf)** — FloBama OS V1 product overview (features, APIs, architecture & database diagrams, runtime flows)
- `flobama-os-v1.html` — HTML companion used during earlier layout experiments

> Note: Parts of `flobama-os-v1.html` describing browser-held OBS credentials as the live cut path are **stale**. Production LED cuts use `clients/led-obs` + `/api/agent/v1/led-wall/sync`. See the local media architecture audit.

### Regenerate the PDF

```bash
pip install reportlab
python3 scripts/generate-flobama-os-v1-pdf.py
```

Output: `docs/flobama-os-v1.pdf`

---

## Other

- [cameras-mac-connector.md](./cameras-mac-connector.md) — Mac Camera connector (pairing, LaunchAgent patterns reused by Local Runner plans)
