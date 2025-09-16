PATCH — Notifications + manifest + robust watcher
-------------------------------------------------
1) Voeg `@capacitor/notifications` toe aan je project (deze ZIP bevat `package.json.patch.json` met die dependency).
   - Open een shell in je repo en run:  `npm i @capacitor/notifications@5`

2) Kopieer/overschrijf in je repo:
   - `src/main.ts`  (uit deze ZIP)
   - `.github/workflows/main.yml` (uit deze ZIP)

3) Commit & push → GitHub **Actions** → run workflow → installeer APK uit Artifacts.

4) Op je toestel (Android 13/14): 
   - Permissions → Location → **Allow all the time**
   - Notifications → **Allowed**
   - Battery → **Unrestricted**
   - System Location → **On** + **Precise**

5) App: druk **Start** → je ziet "Watcher gestart" en "POST ok | GET ok".
   Vergrendel scherm en loop even → in `/dispatch/logs/track.log` verschijnen extra OK-regels.

Laatste update: 2025-09-16T19:20:09.002470Z
