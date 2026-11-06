# Trivia LED wall in OBS

The trivia output can run as its own OBS scene, separate from the mixed `/display/led` browser source that also plays uploaded media.

## Link

Route: `/wall/<token>`

Example shape: `https://flobama-os.vercel.app/wall/<token>`

The token is a signed venue capability, not an event id, pack id, or staff session.

- Trivia in FloBama OS is one live session per venue. It is not stored on an event, so a per-event or per-game URL would change every night and break the Browser Source.
- The token is an HMAC of the venue id. `CRON_SECRET` signs it. If that is unset, the service role key signs it. The same venue and secret always produce the same link.
- Opening the link does not sign anyone in. The page is the trivia wall only: lobby, question, reveal, podium, and final. Between games it holds on a standby frame. It does not show ads, audience tools, or staff controls.
- Correct answers stay hidden until the reveal, the same way the in-app LED wall does. The page polls about once a second.
- A wrong or tampered token is a plain “not valid” screen. It does not offer a login.
- Rotating `CRON_SECRET` (or the service role key, when `CRON_SECRET` is unset) changes the link. Copy the new one from Screens and update OBS, or import a fresh scene collection. No database migration is required.

Copy the link or download the scene collection from **Screens → Trivia**. Admins also see it under **Screens → LED wall → OBS Setup**. The FloBama Screens booth login has it under **Settings**.

## Import the scene collection

The download is `flobama-led-wall-trivia.json`. It is an OBS scene collection (version 1, absolute pixels).

1. In OBS, open **Scene Collection → Import**.
2. Choose `flobama-led-wall-trivia.json`.
3. Open **Scene Collection** and switch to **FloBama LED Wall** if OBS did not switch automatically.
4. Select the scene **LED Wall - Trivia**.
5. Confirm the source **Trivia LED Browser** is a Browser Source whose URL is the trivia wall link, width **1920**, height **1080**.
6. Open **Settings → Video** and set **Base (Canvas) Resolution** to **1920×1080** if the wall canvas is not already that size. The app does not store a separate LED pixel size; 1920×1080 matches the booth overlay and server-station graphics.
7. Make **LED Wall - Trivia** the program scene for the wall output.

The browser source does not need a refresh when the game advances. Leave **Shutdown source when not visible** off if this scene is the program output and should stay warm.

The page permissions on the source are **No access to OBS**, so the wall page cannot change scenes or settings.
