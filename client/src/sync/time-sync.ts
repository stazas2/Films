import { socket } from '../lib/socket';
import { TIME_SYNC_SAMPLES, TIME_SYNC_TRIM, TIME_SYNC_INTERVAL } from 'shared/constants';

interface Sample {
  offset: number;
  rtt: number;
}

let offset = 0;
let synced = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

function pingOnce(): Promise<Sample> {
  return new Promise((resolve) => {
    const t1 = Date.now();
    socket.emit('time:ping', { clientTime: t1 }, (res: { serverTime: number; clientTime: number }) => {
      const t3 = Date.now();
      const t2 = res.serverTime;
      const rtt = t3 - t1;
      const sampleOffset = ((t2 - t1) + (t2 - t3)) / 2;
      resolve({ offset: sampleOffset, rtt });
    });
  });
}

export async function performSync(): Promise<number> {
  const samples: Sample[] = [];

  for (let i = 0; i < TIME_SYNC_SAMPLES; i++) {
    const sample = await pingOnce();
    samples.push(sample);
  }

  // Sort by RTT, trim outliers
  samples.sort((a, b) => a.rtt - b.rtt);
  const trimmed = samples.slice(TIME_SYNC_TRIM, samples.length - TIME_SYNC_TRIM);

  // Average remaining offsets
  offset = trimmed.reduce((sum, s) => sum + s.offset, 0) / trimmed.length;
  synced = true;

  const avgRtt = trimmed.reduce((sum, s) => sum + s.rtt, 0) / trimmed.length;
  console.log(`[sync] offset=${Math.round(offset)}ms rtt=${Math.round(avgRtt)}ms`);

  return offset;
}

export function getServerTime(): number {
  return Date.now() + offset;
}

export function getOffset(): number {
  return offset;
}

export function isSynced(): boolean {
  return synced;
}

export function startPeriodicSync() {
  stopPeriodicSync();
  // Initial sync
  performSync();
  // Re-sync periodically
  intervalId = setInterval(() => performSync(), TIME_SYNC_INTERVAL);
}

export function stopPeriodicSync() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// For testing
export function _reset() {
  offset = 0;
  synced = false;
  stopPeriodicSync();
}
