# Guest photo booth

Portrait kiosk page for the standing Android displays. A Mevo in Wired Webcam mode (or any UVC webcam) is a normal browser camera. Guests get a mirrored preview, a countdown, a FloBama frame, and a QR code. The link is unlisted and the photo is deleted after 48 hours.

The page is `/display/photo-booth` on the same host as `/display/vertical`. Staff can copy it from Screens → Vertical screens.

This is not the live-music booth overlay (`/overlay`, now-playing lower third) and it does not use the Mac camera connector. Those stay on the show cameras.

## What the guest does

1. The idle screen shows the FloBama mark and **Take a photo**.
2. The preview is mirrored, like a mirror. Tap the shutter.
3. A 3-2-1 countdown, then the still.
4. **Retake** or **Keep it**.
5. A QR code opens the photo on their phone. No account and no text message.
6. The kiosk returns to the idle screen on its own (about 90 seconds on the preview, 60 on the review, 45 on the QR screen, 30 on a camera error). Touching the screen resets that timer. Keeping a photo or going back to idle turns the camera off.

The saved still is 1080×1620: a center crop of the webcam with a FloBama footer (logo, tonight’s public show name when one is on, date in America/Chicago). The live kiosks are portrait 1080×1920, about 48 inches. The layout is portrait-first and still keeps the shutter on screen if the window is landscape.

`?demo=1` runs a fake camera so the flow can be checked without hardware. Do not leave that on a guest kiosk.

## Hardware

| Piece | What to plan for |
| --- | --- |
| Kiosk | The standing Android units that already open Chrome to `/display/vertical`. Portrait. USB host / OTG. |
| Mevo Start | One USB-C port does video and charging. Battery is about 6 hours. Android USB host usually does not charge the camera, so an all-night booth needs a powered USB-C dock that can pass UVC, or a plan to swap the battery. |
| Mevo Core | Two USB-C ports. Use one for video to the kiosk and one for power. Prefer Core when the booth stays up all night. |
| Mode | There is no Mevo photo-booth app or Android SDK. After the camera boots, double-tap the power button for Wired Webcam (UVC). It should show up as a standard USB webcam. Official Mevo docs cover Mac and Windows; Android is not documented by Mevo. |
| Stills | Frame grabs. Start is 1080p. Core can do 4K; the booth asks for 1080p so the kiosk stays responsive, then crops to the portrait frame. |
| Light | This is a bar, not a studio. The screen flash is not a strobe. If faces are dark, aim a practical light at the guest. |
| Lock | Use the same Chrome kiosk / Fully Kiosk / lock-task setup as the vertical player. Allow camera permission for this origin and keep it. The page asks for fullscreen and a screen wake lock on the first tap. |

If the kiosk also has a built-in camera, the booth prefers a device whose name contains Mevo, then UVC/USB. **Camera** appears when more than one camera is attached. The choice is saved on that kiosk.

## 15-minute Mevo plug-in test

Do this on the kiosk before a night with guests.

1. Charge the Mevo and power it on. Wait until it has finished booting.
2. Double-tap the power button to enter Wired Webcam (UVC). Use Mevo’s own mode light or the Mevo app docs to confirm the mode.
3. Plug it into the kiosk’s USB host port. Start has only one USB-C port. Core uses the data port, with power on the other port.
4. On the kiosk, open Chrome to `/display/photo-booth` (HTTPS, not the demo URL).
5. Tap **Take a photo**. If Chrome asks, allow the camera for this site.
6. Wave in front of the Mevo and cover any built-in kiosk camera. The preview should follow the Mevo. If it follows the built-in camera, tap **Camera** and choose the Mevo / USB device.
7. Take the countdown, tap **Keep it**, and scan the QR from a phone. The phone should show the branded photo and a save button. The link does not require a FloBama login.
8. Tap **Done**, or wait. The kiosk should return to the idle screen by itself, and the camera preview should stop.

If step 6 finds no camera: confirm UVC mode, try another USB-C cable (some are charge-only), and confirm the kiosk is in USB host mode. Chrome must be allowed to use the camera. A Mevo that is still in its normal streaming mode will not appear as a webcam.

## Privacy and retention

Photos are guest images. The booth does not collect a name, email, or phone number.

- Storage bucket `photo-booth` is private. There is no public list and no staff gallery in this version.
- The database stores a SHA-256 of the share token, not the token. The token is only in the QR link (`/p/…`).
- Guessing a link is not practical (256 bits). Anyone who has the link can view that one photo until it expires.
- Photos expire 48 hours after capture. A cron (`/api/cron/photo-booth`, every 15 minutes) deletes the file and marks the row. Opening an expired link deletes it too. Uploads also clear a few expired files so retention does not depend only on cron.
- The image response is `private, no-store` and `noindex`.
- Rate limits: 30 keeps per 10 minutes per kiosk address, and 400 per venue per day. One kiosk is one address, so the first number is the booth’s pace.

Apply `supabase/migrations/20261112000069_photo_booth.sql`. Uploads use the existing server-only `SUPABASE_SERVICE_ROLE_KEY`. No new secret and no Mevo SDK. The cron uses the same `CRON_SECRET` / `x-vercel-cron` check as the LED wall cron.

Sharing fails closed when the service role or the migration is missing. The guest can still retake; the kiosk tells them the photo was not shared.

## How to try it without a camera

```bash
npm run dev
```

Open `http://localhost:43123/display/photo-booth?demo=1`. Walk through countdown, retake, and keep. Keep will say sharing is not set up until Supabase and the migration are configured. A phone cannot open a `localhost` QR; use the deployed HTTPS origin for the real scan test.

## Deferred

- A printer at the booth.
- An LED-wall gallery of booth photos. That needs a moderation step; these images should not auto-publish.
- SMS or email share. That would collect a phone number or address.
- A native Android camera app. The kiosks run the site in a browser today. The vertical-player APK plan is for playlist playback, not UVC.
- Mevo RTMP, NDI, or the Mevo phone app for this booth. Show cameras stay on the Mac connector.
