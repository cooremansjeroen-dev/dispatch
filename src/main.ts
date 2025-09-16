import { registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { ENDPOINT_BASE, DEFAULT_TEAM, DEFAULT_INCIDENT_ID } from './config';

// BG plugin
interface BGPerm { location: 'granted' | 'denied' | 'prompt'; }
interface BGOptions { requestPermissions?: boolean; stale?: boolean; backgroundTitle?: string; backgroundMessage?: string; distanceFilter?: number; stopOnTerminate?: boolean; startOnBoot?: boolean; }
interface BGLocation { latitude: number; longitude: number; }
interface BGError { code?: string; message?: string; }
interface BackgroundGeolocationPlugin {
  requestPermissions(): Promise<BGPerm>;
  addWatcher(opts: BGOptions, callback: (loc?: BGLocation, err?: BGError) => void): Promise<string>;
  removeWatcher(opts: { id: string }): Promise<void>;
}
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

// Local Notifications (Android 13+ runtime perm)
interface LocalNotificationsPlugin { requestPermissions(): Promise<{ display: 'granted'|'denied' }>; }
const LocalNotifications = registerPlugin<LocalNotificationsPlugin>('LocalNotifications');

const $ = (q: string) => document.querySelector(q) as HTMLElement;
let watcherId: string | null = null;
let fgTimer: any = null; // foreground fallback interval
let team = DEFAULT_TEAM;
let incidentId = DEFAULT_INCIDENT_ID;

function setStatus(msg: string){
  const el = $('#status') as HTMLParagraphElement;
  if (el) el.textContent = msg;
}

async function ensureNotificationPermission() {
  try { await LocalNotifications.requestPermissions(); } catch {}
}

async function postLocation(lat: number, lon: number) {
  const fd = new FormData();
  fd.append('team', team || 'ploeg-1');
  fd.append('incident_id', incidentId);
  fd.append('lat', String(lat));
  fd.append('lon', String(lon));
  const r = await fetch(`${ENDPOINT_BASE}/api/track.php`, { method: 'POST', body: fd, cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

async function testPing(){
  try { await postLocation(51.2194, 4.4025); setStatus('POST ok'); }
  catch(e:any){ setStatus('POST fout: '+(e?.message||e)); }
  try {
    const r = await fetch(`${ENDPOINT_BASE}/api/track.php?team=${encodeURIComponent(team||'ploeg-1')}&lat=51.2194&lon=4.4025`, { cache:'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    setStatus((($('#status') as HTMLParagraphElement).textContent||'')+' | GET ok');
  } catch(e:any) {
    setStatus((($('#status') as HTMLParagraphElement).textContent||'')+' | GET fout: '+(e?.message||e));
  }
}

// ===== Foreground fallback: elke 10s posten met Capacitor Geolocation =====
function startForegroundFallback(){
  if (fgTimer) return;
  fgTimer = setInterval(async () => {
    try{
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      await postLocation(pos.coords.latitude, pos.coords.longitude);
      setStatus('FG sent @ ' + new Date().toLocaleTimeString());
    }catch(e:any){
      setStatus('FG error: '+(e?.message||e));
    }
  }, 10000);
}
function stopForegroundFallback(){ if (fgTimer) { clearInterval(fgTimer); fgTimer = null; } }

// ===== Echte background watcher (blijft, fixen we na werkende fallback) =====
async function startWatcher(){
  const perm = await BackgroundGeolocation.requestPermissions();
  if (perm.location !== 'granted') { setStatus('Locatie-toestemming niet verleend'); return; }

  setStatus('Watcher starten…');
  // @ts-ignore - hints voor sommige toestellen
  const opts: any = {
    requestPermissions: false,
    stale: false,
    backgroundTitle: 'Dispatch tracking',
    backgroundMessage: 'Live locatie actief',
    distanceFilter: 0,
    stopOnTerminate: false,
    startOnBoot: true,
    interval: 15000,
    fastestInterval: 5000,
  };

  watcherId = await BackgroundGeolocation.addWatcher(opts, async (location, error) => {
    if (error) { setStatus('BG error: ' + (error.message || error.code)); return; }
    if (!location) { setStatus('BG: geen locatie'); return; }
    try { await postLocation(location.latitude, location.longitude); setStatus('BG sent @ ' + new Date().toLocaleTimeString()); }
    catch(e:any){ setStatus('Netwerkfout: ' + (e?.message || e)); }
  });
  setStatus('Watcher gestart');
}

async function start(){
  await ensureNotificationPermission();         // Android 13+
  startForegroundFallback();                    // << start foreground polling
  if (!watcherId) await startWatcher();         // << start BG watcher (als het mag)
  await testPing();                             // 1× POST + 1× GET
  (document.getElementById('toggleBtn') as HTMLButtonElement).textContent = 'Stop';
}

async function stop(){
  stopForegroundFallback();
  if (watcherId) { await BackgroundGeolocation.removeWatcher({ id: watcherId }); watcherId = null; }
  setStatus('Tracking gestopt.');
  (document.getElementById('toggleBtn') as HTMLButtonElement).textContent = 'Start';
}

function bindUI(){
  const teamEl = $('#team') as HTMLInputElement;
  const incEl  = $('#incident_id') as HTMLInputElement;
  teamEl.value = DEFAULT_TEAM; incEl.value = DEFAULT_INCIDENT_ID;

  (window as any).toggle = async () => {
    team = (teamEl.value || '').trim() || 'ploeg-1';
    incidentId = (incEl.value || '').trim();
    if ((document.getElementById('toggleBtn') as HTMLButtonElement).textContent === 'Start') await start();
    else await stop();
  };
}
document.addEventListener('DOMContentLoaded', bindUI);
