# FloBama guest app (`apps/mobile`)

Guest-facing Expo (React Native + TypeScript) app for FloBama Music Hall.

**Primary preview path for phone-only Cursor users:** EAS Build → EAS Submit → **TestFlight**.  
This repo does **not** assume you can keep a laptop Expo Go server running or scan a QR code.

## What this milestone includes

- Tabs: **Tonight**, **Events**, **Order**, **More**
- Event detail + share
- Online ordering via system browser → `https://mk360.me/flobamaorder`
- Public API only (`/api/public/v1/now`, `/api/public/v1/events`, `/api/public/v1/events/[id]`)

Out of scope: push, loyalty, guest accounts, WebView checkout, staff APIs.

## Cloud-only preview (recommended)

### One-time account setup (you do this)

1. **Expo account** — [expo.dev/signup](https://expo.dev/signup). Install nothing on your phone yet.
2. **Apple Developer Program** membership (paid) for the FloBama / View360 org.
3. In [App Store Connect](https://appstoreconnect.apple.com):
   - Create an app named **FloBama** (or confirm the existing one).
   - Note the **Apple ID** numeric App Store Connect app id (`ascAppId`).
   - Note your **Team ID** (Apple Developer → Membership).
4. Register an **iOS Bundle ID** you own (candidate in config: `com.flobama.guest` — change if you don’t own it).
5. Create an **App Store Connect API Key** (Users and Access → Integrations → App Store Connect API) with access to submit builds. Download the `.p8` once; store it outside GitHub.
6. On Expo: create/link the project from a trusted machine or ask the cloud agent **after** you paste credentials into Expo secrets (never commit them):

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init   # writes EAS projectId — review the diff before committing
```

7. Store secrets in the **Expo dashboard** (project → Environment variables / credentials), not in this repo:
   - `ASC_APP_ID`
   - `APPLE_TEAM_ID`
   - ASC API key fields (`ASC_API_KEY_ID`, `ASC_API_KEY_ISSUER_ID`, key file via EAS credentials)
   - Optional: `IOS_BUNDLE_IDENTIFIER`, `EAS_PROJECT_ID`, `EXPO_OWNER`

### Build for TestFlight (ask the agent before running)

When you are ready, say explicitly that we may **upload a build** (and later **submit**):

```bash
cd apps/mobile
npx eas-cli@latest build --platform ios --profile preview
```

After the build succeeds and you approve submit:

```bash
npx eas-cli@latest submit --platform ios --profile preview --latest
```

Then install via the **TestFlight** app on your iPhone (invite your Apple ID as an internal tester).

Agents in this repo must **ask before** `eas build` upload or `eas submit`.

### When a custom development build is required

Expo Go is fine for JS-only iteration **if** you have a Mac/simulator or a temporary tunnel.  
A **development build** (`development` / `development-simulator` profiles + `expo-dev-client`) is required once you add native modules not in Expo Go, or when you want device testing without Expo Go. TestFlight **preview/production** builds already use a full native binary — preferred for phone-only review.

## Commands (from repo)

```bash
cd apps/mobile
cp .env.example .env.local   # optional
npm install
npm run typecheck
npx expo-doctor
npx expo config --type public
npm start                    # optional Metro; not the primary phone preview path
```

## Environment

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | Public FloBama OS origin (default `https://flobama-os.vercel.app`) |

No service-role keys, GHL tokens, or staff secrets in mobile code or `EXPO_PUBLIC_*`.

## Icons / branding

Splash and icon are derived from `public/flobama-logo.png`. They are **not** claimed to meet final App Store marketing/asset checklist — review sizes, safe area, and marketing screenshots before submission.

## Handoff gaps

- Confirm owned bundle identifier + Expo `projectId` + ASC ids before signed builds.
- Dedicated App Store **support URL** / **marketing URL** if Apple requires them beyond the privacy page.
- Public API currently has **no artwork or description** fields; UI shows them only when present.
- Ticket buttons only for verified external HTTPS checkouts (not FloBama OS mock `/tickets`).
