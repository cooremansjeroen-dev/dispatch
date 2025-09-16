# Dispatch Tracking — APK in 10 minuten (All-in-One)

Dit pakket bevat **alles** om een **APK** te bouwen via **GitHub Actions** (geen Android Studio nodig).
Endpoint staat op: `https://jeroencooremans.com/dispatch`.

## Snelplan (cloud build)
1) Maak een **private GitHub-repo**.
2) Upload de **inhoud** van deze ZIP (niet de ZIP zelf) in de repo-root.
3) Ga naar **Actions** → **Build & Upload Android Debug APK** → **Run workflow**.
4) Download het APK bij **Artifacts** (of laat ‘m via SFTP naar je site uploaden als je secrets zet).

## SFTP (optioneel)
Zet in repo **Settings → Secrets → Actions**: `SFTP_HOST`, `SFTP_USER`, `SFTP_PASS` en evt. `SFTP_PATH`. 
De workflow uploadt dan naar `.../dispatch/app/DispatchTracking.apk`.

Laatste update: 2025-09-16T16:06:24.416590Z
