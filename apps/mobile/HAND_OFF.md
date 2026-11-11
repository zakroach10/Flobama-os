# FloBama guest app — cloud / TestFlight handoff

## Phone-only Cursor workflow

You drive this from Cursor on your phone. **Do not rely on a laptop Expo Go QR session.**

Recommended path:

1. Complete one-time Apple + Expo setup (below).
2. Ask the cloud agent to run **EAS Build** (`preview` profile) **only after you approve upload**.
3. Ask the cloud agent to run **EAS Submit** to TestFlight **only after you approve submit**.
4. Install the build from the **TestFlight** app on your iPhone.

Credentials must live in Expo / Apple — **never in GitHub**.

## One-time setup you must complete

| Item | Where | Notes |
| --- | --- | --- |
| Expo account | expo.dev | Required for EAS Build/Submit |
| Apple Developer Program | developer.apple.com | Paid membership |
| Bundle ID | Apple Developer → Identifiers | Candidate in config: `com.flobama.guest` — change if you do not own it |
| App Store Connect app | appstoreconnect.apple.com | Create **FloBama**; copy numeric Apple ID (`ascAppId`) |
| Apple Team ID | Developer → Membership | Needed for signing / submit |
| ASC API key (`.p8`) | ASC → Users and Access → Integrations | Store outside git; upload to EAS credentials |
| `eas init` / project link | `apps/mobile` | Produces Expo `projectId` — review before commit |
| Expo project secrets | Expo dashboard | `ASC_APP_ID`, `APPLE_TEAM_ID`, API key refs — not in repo |

Agents will **ask before** `eas build` (upload) or `eas submit`.

## Commands (when you approve)

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init          # once
npx eas-cli@latest build --platform ios --profile preview
npx eas-cli@latest submit --platform ios --profile preview --latest
```

## Still missing for App Store release

- Confirmed owned bundle identifier + Expo project id
- App Store marketing URL / support URL (privacy page exists: `/privacy-policy`)
- Final icon/screenshot compliance review (current assets are derived from the wordmark; not certified)
- Opening hours are **not** shown as authoritative in-app (contact page has hours; Tonight empty state does not imply closed)

## Not in this milestone

Push notifications, favorites, guest accounts, birthday submissions, polls, loyalty, WebView checkout, staff APIs.
