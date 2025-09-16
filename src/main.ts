import { registerPlugin } from '@capacitor/core';
import { ENDPOINT_BASE, DEFAULT_TEAM, DEFAULT_INCIDENT_ID } from './config';

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

const $ = (q: string) => document.querySelector(q) as HTMLElement;
let watcherId: string | null = null;
let team = DEFAULT_TEAM;
let incidentId = DEFAULT_INCIDENT_ID;

function setStatus(msg: string){
  const el = $('#status') as HTMLParagraphElement;
  if (el) el.textContent = msg;
}

async function postLocation(lat: number, lon: number) {
  const fd = new FormData();
  fd.append('team', team);
  fd.append('incident_id', incidentId);
  fd.append('lat', String(lat));
  fd.append('lon', String(lon));
  const r = await fetch(`${ENDPOINT_BASE}/api/track.php`, { method: 'POST', body: fd, cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

async function testPing(){
  // 1) POST met vaste coördinaat (Antwerpen)
  try { await postLocation(51.2194, 4.4025); setStatus('POST ok'); }
  catch(e:any){ setStatus('POST fout: ' + (e?.message || e)); }

  // 2) GET met dezelfde coördinaat
  try {
    const url = `${ENDPOINT_BASE}/api/track.php?team=${encodeURIComponent(team||'ploeg-1')}&lat=51.2194&lon=4.4025`;
    const r = await fetch(url, { cache:'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    setStatus((($('#status') as HTMLParagraphElement).textContent || '') + ' | GET ok');
  } catch(e:any) {
    setStatus((($('#status') as HTMLParagraphElement).textContent || '') + ' | GET fout: ' + (e?.message || e));
  }
}

async function startTracking(){
  if (watcherId) return;
  const perm = await BackgroundGeolocation.requestPermissions();
  if (perm.location !== 'granted') { setStatus('Locatie-toestemming niet verleend'); return; }
  setStatus('Start achtergrond tracking…');
  watcherId = await BackgroundGeolocation.addWatcher(
    { requestPermissions:false, stale:false, backgroundTitle:'Dispatch tracking', backgroundMessage:'Live locatie actief', distanceFilter:0, stopOnTerminate:false, startOnBoot:true },
    async (location, error) => {
      if (error) { setStatus('BG error: ' + (error.message || error.code)); return; }
      if (!location) return;
      try { await postLocation(location.latitude, location.longitude); setStatus('Sent @ ' + new Date().toLocaleTimeString()); }
      catch(e:any){ setStatus('Netwerkfout: ' + (e?.message || e)); }
    }
  );
}

async function stopTracking(){
  if (watcherId) { await BackgroundGeolocation.removeWatcher({ id: watcherId }); watcherId = null; }
  setStatus('Tracking gestopt.');
  (document.getElementById('toggleBtn') as HTMLButtonElement).textContent='Start';
}

function bindUI(){
  const teamEl = $('#team') as HTMLInputElement;
  const incEl  = $('#incident_id') as HTMLInputElement;
  const btn    = $('#toggleBtn') as HTMLButtonElement;
  teamEl.value = DEFAULT_TEAM;
  incEl.value  = DEFAULT_INCIDENT_ID;

  (window as any).toggle = async () => {
    // Zorg voor default team zodat we nooit stoppen vóór testPing
    team = (teamEl.value || '').trim() || 'ploeg-1';
    incidentId = (incEl.value || '').trim();

    (document.getElementById('toggleBtn') as HTMLButtonElement).textContent='Stop';

    // >>> Doe ALTIJD eerst de netwerk-test (zonder plugin/permissies)
    await testPing();

    // Daarna pas achtergrond-tracking starten (mag mislukken, test is al gepost)
    if (!watcherId) await startTracking();
  };
}
document.addEventListener('DOMContentLoaded', bindUI);
