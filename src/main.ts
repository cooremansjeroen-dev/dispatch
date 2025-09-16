
import { registerPlugin } from '@capacitor/core';
import { ENDPOINT_BASE, DEFAULT_TEAM, DEFAULT_INCIDENT_ID } from './config';

// Declare minimal plugin interface so TS knows the methods.
interface BGPerm { location: 'granted' | 'denied' | 'prompt'; }
interface BGOptions {
  requestPermissions?: boolean;
  stale?: boolean;
  backgroundTitle?: string;
  backgroundMessage?: string;
  distanceFilter?: number;
  stopOnTerminate?: boolean;
  startOnBoot?: boolean;
}
interface BGLocation { latitude: number; longitude: number; }
interface BGError { code?: string; message?: string; }

interface BackgroundGeolocationPlugin {
  requestPermissions(): Promise<BGPerm>;
  addWatcher(opts: BGOptions, callback: (loc?: BGLocation, err?: BGError) => void): Promise<string>;
  removeWatcher(opts: { id: string }): Promise<void>;
}

// Register by name; native bridge is provided after `npx cap sync android`
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
  try{
    const fd = new FormData();
    fd.append('team', team);
    fd.append('incident_id', incidentId);
    fd.append('lat', String(lat));
    fd.append('lon', String(lon));
    await fetch(`${ENDPOINT_BASE}/api/track.php`, { method: 'POST', body: fd, cache: 'no-store' });
    setStatus(`Sent @ ${new Date().toLocaleTimeString()}`);
  }catch(e:any){
    setStatus(`Netwerkfout: ${e?.message || e}`);
  }
}

async function startTracking(){
  if (watcherId) return;
  const perm = await BackgroundGeolocation.requestPermissions();
  if (perm.location !== 'granted') { setStatus('Locatie-toestemming niet verleend'); return; }
  setStatus('Start achtergrond tracking…');
  watcherId = await BackgroundGeolocation.addWatcher(
    {
      requestPermissions: false,
      stale: false,
      backgroundTitle: 'Dispatch tracking',
      backgroundMessage: 'Live locatie delen actief',
      distanceFilter: 0,
      stopOnTerminate: false,
      startOnBoot: true,
    },
    async (location, error) => {
      if (error) { setStatus('BG error: ' + (error.message || error.code)); return; }
      if (!location) return;
      await postLocation(location.latitude, location.longitude);
    }
  );
  ($('#toggleBtn') as HTMLButtonElement).textContent = 'Stop';
}

async function stopTracking(){
  if (watcherId) {
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
    watcherId = null;
  }
  setStatus('Tracking gestopt.');
  ($('#toggleBtn') as HTMLButtonElement).textContent = 'Start';
}

function bindUI(){
  const teamEl = $('#team') as HTMLInputElement;
  const incEl  = $('#incident_id') as HTMLInputElement;
  const btn    = $('#toggleBtn') as HTMLButtonElement;
  teamEl.value = DEFAULT_TEAM;
  incEl.value  = DEFAULT_INCIDENT_ID;
  (window as any).toggle = async () => {
    team = teamEl.value.trim();
    incidentId = incEl.value.trim();
    if (!team) { alert('Team vereist'); return; }
    if (!watcherId) await startTracking();
    else await stopTracking();
  };
}

document.addEventListener('DOMContentLoaded', bindUI);
