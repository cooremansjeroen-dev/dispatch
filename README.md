# Dispatch Tracking — FIXED build (no Vite import issue)

Deze versie **importeert de BG plugin niet meer in Vite**. In plaats daarvan gebruiken we
`registerPlugin('BackgroundGeolocation')`. Zo kan Vite de webbuild doen zonder fout,
én krijgt Android de native plugin via `npx cap sync android`.

## Snelplan (GitHub Actions)
1) Maak een **private repo** op GitHub en upload **de inhoud** van deze ZIP.
2) Ga naar **Actions** → **Build & Upload Android Debug APK** → **Run workflow**.
3) Download het APK bij **Artifacts**.  
   *(Optioneel)* Zet SFTP secrets voor automatische upload.

## Belangrijk
- Endpoint staat op: `https://jeroencooremans.com/dispatch` (aanpasbaar in `src/config.ts`).
- Workflow gebruikt nu **`npx cap sync android`** i.p.v. alleen copy.
- Je **mag** de npm dependency `@capacitor-community/background-geolocation` laten staan; we importeren hem niet in web code.

Laatste update: 2025-09-16T16:16:08.598970Z
