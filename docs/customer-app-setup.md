# FloBama customer app setup

The customer app is in `apps/customer`. It is an Expo app that builds to the App Store and Google Play with EAS Build. It talks only to FloBama OS public HTTP routes. It does not contain a Supabase service-role key, a Mux secret, or a Stripe secret.

This change does **not** apply the database migration to the production Supabase project and does **not** deploy to Vercel. Apply the migration and set the environment variables below when you are ready.

## What you need to create

### 1. Mux (live video)

Sign up at [mux.com](https://mux.com). Pick a plan that includes live streaming. You do not need YouTube or Facebook.

In the Mux dashboard:

1. Create an access token with **Mux Video** read access. Copy the token id and token secret once.
2. Create a live stream.
   - Latency: standard is fine for a venue stream.
   - Playback policy: **public**. The app plays `https://stream.mux.com/{PLAYBACK_ID}.m3u8`. Signed playback is not wired.
3. Copy the live stream id and the public playback id.
4. Add a webhook endpoint:
   - URL: `https://admin.flobamadowntown.com/api/webhooks/mux`
   - Event: `video.asset.ready`
   - Copy the signing secret.

On the booth Mac, in Ecamm Live or OBS:

- Server: `rtmp://global-live.mux.com:5222/app`
- Stream key: the key Mux shows on that live stream. Keep it on the booth Mac only. Do not put it in the app, in git, or in Supabase.

When Ecamm or OBS is streaming, Mux reports the live stream as `active` and the app shows **Live now**. When the encoder stops, the app shows the offline state and does not keep playing the last video as if it were live. After the stream ends, Mux creates an asset and the webhook saves a **draft** recording under Staff → Customer app → Recordings. Publish it and attach the show and artist before guests can watch it.

### 2. Stripe (merch, test mode only)

Sign up at [dashboard.stripe.com](https://dashboard.stripe.com) and stay in **test mode**.

1. Copy the test secret key (`sk_test_...`).
2. Add a webhook endpoint:
   - URL: `https://admin.flobamadowntown.com/api/webhooks/stripe-merch`
   - Event: `checkout.session.completed`
   - Copy the signing secret (`whsec_...`).

Use a separate key from ticket checkout. Ticket sales still use the mock adapter and still refuse `STRIPE_SECRET_KEY`. Merch reads `STRIPE_MERCH_SECRET_KEY` only. A live key (`sk_live_` or `rk_live_`) is rejected and no charge is created. Do not switch the merch key to live mode until you have decided to take real payments. That is outside this change.

With no merch key set, the app uses an in-app test checkout that records an order and charges nothing. That path is for development.

### 3. Apple Developer

Enroll at [developer.apple.com/programs](https://developer.apple.com/programs) (paid annual membership). You need this before App Store submission. The bundle id in the app is `com.flobamadowntown.app`.

### 4. Google Play Console

Register at [play.google.com/console](https://play.google.com/console) (one-time fee). The Android package is `com.flobamadowntown.app`.

### 5. Expo account

Create a free account at [expo.dev](https://expo.dev). EAS Build produces the iOS and Android binaries in the cloud, so a connected Xcode cloud worker is not required. You still need a Mac with Xcode only if you want to run the iOS simulator locally. `eas submit` uploads the finished binaries to App Store Connect and Play Console.

## Database

Apply this file on the Supabase project after you review it. It is additive: new tables and views, plus a `customer` staff menu. It does not change events, the LED wall, trivia, production, or the local runner.

`supabase/migrations/20261114000070_customer_app.sql`

It seeds a starter food menu and three merch products (tee, hat, koozie). Edit or archive them under **Customer app** in the staff sidebar. Artist bios and public event descriptions become visible in the app once this migration is applied, because the app reads public views of those fields. Internal event notes stay off the views.

Until that migration is applied, staff Customer app screens explain the gap. If the public Supabase env vars are missing, or `CUSTOMER_APP_FIXTURES=1`, the customer API serves sample shows so the app can be previewed. Those sample shows are labeled in the app.

## Environment variables

Set these on the FloBama OS host (Vercel → Project → Settings → Environment Variables, and `.env.local` for local dev). All of them are server-only.

| Variable | Required for | Notes |
| --- | --- | --- |
| `MUX_TOKEN_ID` | Live status | Mux access token id |
| `MUX_TOKEN_SECRET` | Live status | Mux access token secret |
| `MUX_LIVE_STREAM_ID` | Live status | The live stream the booth sends RTMP to |
| `MUX_PLAYBACK_ID` | Optional | Public playback id. If empty, the status call reads it from Mux |
| `MUX_WEBHOOK_SECRET` | Past shows | Verifies `video.asset.ready` |
| `CUSTOMER_STREAM_FIXTURE` | Local preview | `live` plays Mux’s public test video and marks it as a preview. Leave empty for the offline state |
| `STRIPE_MERCH_SECRET_KEY` | Real test checkout | Must start with `sk_test_` |
| `STRIPE_MERCH_WEBHOOK_SECRET` | Paid orders | Stripe webhook signing secret |
| `CUSTOMER_APP_FIXTURES` | Local preview | `1` serves the sample schedule instead of Supabase |

Do not set `STRIPE_SECRET_KEY` for merch. That name still belongs to ticket checkout.

The phone app only needs the API origin:

`apps/customer/.env` (gitignored):

```bash
EXPO_PUBLIC_FLOBAMA_API_URL=http://localhost:43123
```

Production EAS builds in `apps/customer/eas.json` set this to `https://admin.flobamadowntown.com`. Change it if the admin host changes. The API routes are under `/api/public/v1/customer/`.

## Run it locally

From the repo root, with the API:

```bash
npm install
npm run dev
```

In another terminal:

```bash
cd apps/customer
npm install
npx expo start
```

Press `w` for the web preview, or scan the QR code with Expo Go. iOS simulator needs Xcode (`npx expo start` then `i`). Android emulator needs Android Studio.

With no Supabase env and no Mux key, the API serves the sample schedule, menu, and merch, and the stage is offline. To preview the player, set `CUSTOMER_STREAM_FIXTURE=live` and restart `npm run dev`.

Merch: add a hat in the Shop tab, enter an email, and place the test order. Staff will see it under Customer app → Orders once Supabase and the migration are in place. In fixture mode the order lives in the API process memory.

## Build and submit

Install the EAS CLI once (`npm install -g eas-cli`), then from `apps/customer`:

```bash
eas login
eas build --platform ios --profile production
eas build --platform android --profile production
```

The first iOS build asks you to sign in with the Apple Developer account so EAS can create the distribution certificate and provisioning profile. The first Android build creates an upload keystore and stores it on Expo’s servers. Accept that only if you want Expo to hold the keystore. You can also supply your own.

After both builds succeed:

```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

`eas submit` for iOS needs an App Store Connect app whose bundle id is `com.flobamadowntown.app`, plus an app-specific Apple ID password or an App Store Connect API key. Google Play needs a service account JSON with release permission, passed to `eas submit` when it asks. Create the store listings (name FloBama, screenshots, privacy policy URL `https://flobamadowntown.com/privacy-policy` or the policy page on the admin site) in each console before you can release.

Submit a build only after the migration is applied and the Mux and Stripe variables are set on the admin host the app calls. Otherwise the store build will show an empty schedule and an offline stage.
