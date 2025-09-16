JSK disp — app patch (background robuust + menu/kaart)

Wat zit erin?
- src/main.ts  → volledige app-logic (Foreground fallback, BG watcher, notificatierechten, KeepAwake, menu+kaart).
- package.json.additions.json → dependencies die je moet hebben.
- workflow-snippet.yml → YAML-blok voor GitHub Actions om plugins te installeren en te syncen.

Snel gebruik:
1) Vervang je huidige src/main.ts door deze versie.
2) In package.json: voeg deze deps toe (of run in CI de 'Ensure plugin deps present' stap):
   - @capacitor/app, @capacitor/geolocation, @capacitor/local-notifications,
     @capacitor-community/background-geolocation, @capacitor-community/keep-awake
3) Zorg dat je workflow na 'npm install' de assets genereert en vóór het builden 'npx cap sync android' draait.
4) Build APK opnieuw.

Niet vergeten op het toestel:
- Location → Allow all the time
- Notifications → Allowed
- Battery → Unrestricted
- System Location → On + Precise
