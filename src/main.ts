// src/main.ts
import { registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

import { ENDPOINT_BASE, DEFAULT_TEAM, DEFAULT_INCIDENT_ID } from './config';

import { registerPlugin } from '@capacitor/core';
// ... (je andere imports blijven staan)

// Capgo Updater via registerPlugin (compat met verschillende API-namen)
const Updater = registerPlugin<{
  download(options: { url: string; version: string }): Promise<void>;
  set(options: { version: string }): Promise<void>;
  reload(): Promise<void>;
  getCurrentBundleInfo?(): Promise<{ version?: string }>; // sommige versies
  current?(): Promise<{ version?: string }>;              // andere versies
}>('Updater');


// --------- Plugins (via registerPlugin om Vite-resolve issues te vermijden) ----------
interface BGPerm { location: 'granted' | 'denied' | 'prompt'; }
interface BGOptions {
  requestPermissions?: boolean; stale?: boolean;
  backgroundTitle?: string; backgroundMessage?: string;
  distanceFilter?: number; stopOnTerminate?: boolean; startOnBoot?: boolean;
  interval?: number; fastestInterval?: number;
}
interface BGLocation { latitude: number; longitude: number; }
interface BGError { code?: string; message?: string; }
interface BackgroundGeolocationPlugin {
  requestPermissions(): Promise<BGPerm>;
  addWatcher(opts: BGOptions, cb: (loc?: BGLocation, err?: BGError) => void): Promise<string>;
  removeWatcher(opts: { id: string }): Promise<void>;
}
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

interface LocalNotificationsPlugin { requestPermissions(): Promise<{ display: 'granted' | 'denied' }>; }
const LocalNotifications = registerPlugin<LocalNotificationsPlugin>('LocalNotifications');

// --------- Kleine helpers ----------
const $ = (q: string) => document.querySelector(q) as HTMLElement | null;
let watcherId: string | null = null;
let fgTimer: any = null;
let team = DEFAULT_TEAM;
let incidentId = DEFAULT_INCIDENT_ID;

function setStatus(msg: string) {
  console.log('[STATUS]', msg);
  const el = $('#status') as HTMLParagraphElement | null;
  if (el) el.textContent = msg;
}

async function ensureBackgroundOK() {
  try { await LocalNotifications.requestPermissions(); } catch {}
  try { await Geolocation.requestPermissions(); } catch {}
  try {
    const perm = await BackgroundGeolocation.requestPermissions();
    if (perm.location !== 'granted') {
      setStatus('Geef "Altijd toestaan" in App-instellingen');
      try { await App.openSettings(); } catch {}
    }
  } catch {}
}

// --------- OTA update (Capgo) ----------
function cmpSemver(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

async function checkForUpdates() {
  try {
    const url = `${ENDPOINT_BASE}/app/version.json?ts=${Date.now()}`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error('manifest http ' + resp.status);
    const manifest = await resp.json();

    const appInfo = await App.getInfo();
    let current: any = null;
try {
  if (Updater.getCurrentBundleInfo) {
    current = await Updater.getCurrentBundleInfo();
  } else if (Updater.current) {
    current = await Updater.current();
  }
} catch {}

    console.log('[Updater] current bundle:', current?.version, 'native:', appInfo.version);
    console.log('[Updater] manifest:', manifest);

    // Minimale native app-versie afdwingen (optioneel)
    if (manifest.minNativeVersion && cmpSemver(appInfo.version, manifest.minNativeVersion) < 0) {
      setStatus(`Nieuwe app versie vereist (min. ${manifest.minNativeVersion})`);
      if (manifest.apkUrl) await Browser.open({ url: manifest.apkUrl });
      return;
    }

    // Nieuwe web bundle?
    if (manifest.bundleVersion && manifest.bundleUrl && current?.version !== manifest.bundleVersion) {
      setStatus(`Update v${manifest.bundleVersion} downloaden…`);
      await Updater.download({ url: manifest.bundleUrl, version: manifest.bundleVersion });
      await Updater.set({ version: manifest.bundleVersion });
      // >>> Laad onmiddellijk de nieuwe bundle
      await Updater.reload();
      return; // reload herstart de webview, code hieronder wordt niet meer uitgevoerd
    }

    setStatus('App is up-to-date');
  } catch (e: any) {
    console.warn('update-check failed', e?.message || e);
    setStatus('Update-check mislukt');
  }
}

// --------- Tracking POST ----------
async function postLocation(lat: number, lon: number) {
  const url = `${ENDPOINT_BASE}/api/track.php`;
  // 1) Probeer FormData
  try {
    const fd = new FormData();
    fd.append('team', team || 'ploeg-1');
    fd.append('incident_id', incidentId);
    fd.append('lat', String(lat));
    fd.append('lon', String(lon));
    const r = await fetch(url, { method: 'POST', body: fd, cache: 'no-store' });
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${txt}`);
    console.log('[POST ok]', txt);
    setStatus('POST ok');
    return;
  } catch (e: any) {
    console.warn('[POST error FormData]', e);
  }
  // 2) Fallback JSON
  try {
    const r2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team, incident_id: incidentId, lat, lon })
    });
    const t2 = await r2.text();
    if (!r2.ok) throw new Error(`HTTP ${r2.status} ${t2}`);
    console.log('[POST ok JSON]', t2);
    setStatus('POST ok (json)');
  } catch (e2: any) {
    console.error('[POST error JSON]', e2);
    setStatus('Netwerkfout: ' + (e2?.message || e2));
  }
}

// Eénmalige sanity test
async function testPing() {
  try { await postLocation(51.2194, 4.4025); } catch {}
  try {
    const r = await fetch(`${ENDPOINT_BASE}/api/track.php?team=${encodeURIComponent(team || 'ploeg-1')}&lat=51.2194&lon=4.4025`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    setStatus(((($('#status') as HTMLParagraphElement | null)?.textContent) || '') + ' | GET ok');
  } catch (e: any) {
    setStatus(((($('#status') as HTMLParagraphElement | null)?.textContent) || '') + ' | GET fout: ' + (e?.message || e));
  }
}

// --------- Foreground fallback (10s) ----------
function startForegroundFallback() {
  if (fgTimer) return;
  fgTimer = setInterval(async () => {
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      await postLocation(pos.coords.latitude, pos.coords.longitude);
      setStatus('FG sent @ ' + new Date().toLocaleTimeString());
    } catch (e: any) {
      setStatus('FG error: ' + (e?.message || e));
    }
  }, 10000);
}
function stopForegroundFallback() { if (fgTimer) { clearInterval(fgTimer); fgTimer = null; } }

// --------- Background watcher ----------
async function startWatcher() {
  try {
    const perm = await BackgroundGeolocation.requestPermissions();
    if (perm.location !== 'granted') { setStatus('Locatie-toestemming niet verleend'); return; }
  } catch {}
  setStatus('Watcher starten…');
  const opts: BGOptions = {
    requestPermissions: false,
    stale: false,
    backgroundTitle: 'Dispatch tracking',
    backgroundMessage: 'Live locatie actief',
    distanceFilter: 0,
    stopOnTerminate: false,
    startOnBoot: true,
    interval: 15000,
    fastestInterval: 5000
  };
  watcherId = await BackgroundGeolocation.addWatcher(opts, async (location, error) => {
    if (error) { setStatus('BG error: ' + (error.message || error.code)); return; }
    if (!location) { setStatus('BG: geen locatie'); return; }
    try {
      await postLocation(location.latitude, location.longitude);
      setStatus('BG sent @ ' + new Date().toLocaleTimeString());
    } catch (e: any) {
      setStatus('Netwerkfout: ' + (e?.message || e));
    }
  });
  setStatus('Watcher gestart');
}

async function stopWatcher() {
  if (watcherId) {
    try { await BackgroundGeolocation.removeWatcher({ id: watcherId }); } catch {}
    watcherId = null;
  }
}

// --------- UI: start/stop + team/incident ----------
async function start() {
  await checkForUpdates();               // haalt nieuwe bundle op en reloadt zo nodig
  await ensureBackgroundOK();            // vraag perms
  startForegroundFallback();             // foreground fallback
  if (!watcherId) await startWatcher();  // echte BG-tracking
  await testPing();                      // 1× POST + 1× GET
  const btn = $('#toggleBtn') as HTMLButtonElement | null;
  if (btn) btn.textContent = 'Stop';
}
async function stop() {
  stopForegroundFallback();
  await stopWatcher();
  setStatus('Tracking gestopt.');
  const btn = $('#toggleBtn') as HTMLButtonElement | null;
  if (btn) btn.textContent = 'Start';
}

function bindUI() {
  const teamEl = $('#team') as HTMLInputElement | null;
  const incEl  = $('#incident_id') as HTMLInputElement | null;
  if (teamEl) teamEl.value = DEFAULT_TEAM;
  if (incEl)  incEl.value  = DEFAULT_INCIDENT_ID;

  (window as any).toggle = async () => {
    team = (teamEl?.value || '').trim() || 'ploeg-1';
    incidentId = (incEl?.value || '').trim();
    const btn = $('#toggleBtn') as HTMLButtonElement | null;
    if (!btn || btn.textContent === 'Start') await start();
    else await stop();
  };
}
document.addEventListener('DOMContentLoaded', bindUI);

// --------- MENU + KAART ----------
function setActive(tab: 'track' | 'map') {
  const aTrack = $('#nav-track'); const aMap = $('#nav-map');
  if (aTrack) aTrack.classList.toggle('active', tab === 'track');
  if (aMap)   aMap.classList.toggle('active', tab === 'map');

  $('#view-track')?.classList.toggle('hidden', tab !== 'track');
  $('#view-map')?.classList.toggle('hidden', tab !== 'map');
}

let mapInited = false;
let mapObj: any = null;
let leafletLoaded = false;
let markers = new Map<string, any>();
let mapTimer: any = null;

function loadLeaflet(): Promise<void> {
  if (leafletLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => { leafletLoaded = true; resolve(); };
    document.body.appendChild(js);
  });
}

async function initMap() {
  if (mapInited) return;
  await loadLeaflet();
  // @ts-ignore
  mapObj = (window as any).L.map('map').setView([51.0, 4.4], 8);
  // @ts-ignore
  (window as any).L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapObj);

  async function refresh() {
    try {
      const r = await fetch(`${ENDPOINT_BASE}/api/tracks_latest.php`, { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) return;
      j.rows.forEach((row: any) => {
        const key = row.team;
        const lat = parseFloat(row.lat), lon = parseFloat(row.lon);
        if (!isFinite(lat) || !isFinite(lon)) return;
        if (markers.has(key)) {
          markers.get(key).setLatLng([lat, lon]).bindTooltip(key, { permanent: false });
        } else {
          // @ts-ignore
          const m = (window as any).L.marker([lat, lon], { title: key }).addTo(mapObj).bindTooltip(key);
          markers.set(key, m);
        }
      });
    } catch (e) { console.warn('map refresh error', e); }
  }

  await refresh();
  mapTimer = setInterval(refresh, 5000);
  mapInited = true;
}

function showView(which: 'track' | 'map') {
  setActive(which);
  if (which === 'map') initMap();
  if (which === 'track' && mapTimer) { clearInterval(mapTimer); mapTimer = null; }
}

window.addEventListener('hashchange', () => {
  const tab = (location.hash.replace('#', '') || 'track') as 'track' | 'map';
  showView(tab === 'map' ? 'map' : 'track');
});

document.addEventListener('DOMContentLoaded', () => {
  const tab = (location.hash.replace('#', '') || 'track') as 'track' | 'map';
  showView(tab === 'map' ? 'map' : 'track');
});
