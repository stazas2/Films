import {
  DRIFT_DEAD_ZONE,
  DRIFT_SOFT_LIMIT,
  DRIFT_RATE_FAST,
  DRIFT_RATE_SLOW,
  DRIFT_RECOVERY_ZONE,
  SYNC_INTERVAL,
} from 'shared/constants';
import { getServerTime } from './time-sync';
import { socket } from '../lib/socket';
import type { SyncPacket } from 'shared/types';

let videoEl: HTMLVideoElement | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let correcting = false;

export function startDriftCorrection(video: HTMLVideoElement) {
  stopDriftCorrection();
  videoEl = video;

  socket.on('sync:packet', onSyncPacket);
}

export function stopDriftCorrection() {
  socket.off('sync:packet', onSyncPacket);
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (videoEl) {
    videoEl.playbackRate = 1.0;
  }
  videoEl = null;
  correcting = false;
}

/** Called by host to start sending periodic sync packets */
export function startHostSync(video: HTMLVideoElement) {
  stopHostSync();
  intervalId = setInterval(() => {
    if (video.paused) return;
    const packet: SyncPacket = {
      type: 'sync',
      time: video.currentTime,
      serverTimestamp: getServerTime(),
      userId: socket.id || '',
    };
    socket.emit('sync:packet', packet);
  }, SYNC_INTERVAL);
}

export function stopHostSync() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function onSyncPacket(packet: SyncPacket) {
  if (packet.type !== 'sync') return;
  if (!videoEl) return;
  if (videoEl.paused) return;

  // Check if buffering (readyState < HAVE_FUTURE_DATA)
  if (videoEl.readyState < 3) return;

  const now = getServerTime();
  const elapsed = (now - packet.serverTimestamp) / 1000; // seconds since packet was sent
  const targetTime = packet.time + elapsed;
  const drift = videoEl.currentTime - targetTime; // positive = we're ahead

  correctDrift(drift, targetTime);
}

export function correctDrift(drift: number, targetTime: number) {
  if (!videoEl) return;

  const absDrift = Math.abs(drift) * 1000; // ms

  if (absDrift < DRIFT_DEAD_ZONE) {
    // Within dead zone — reset rate if we were correcting
    if (correcting) {
      videoEl.playbackRate = 1.0;
      correcting = false;
    }
    return;
  }

  if (absDrift < DRIFT_SOFT_LIMIT) {
    // Soft correction via playbackRate
    videoEl.playbackRate = drift > 0 ? DRIFT_RATE_SLOW : DRIFT_RATE_FAST;
    correcting = true;

    // Check if we recovered
    if (absDrift < DRIFT_RECOVERY_ZONE) {
      videoEl.playbackRate = 1.0;
      correcting = false;
    }
    return;
  }

  // Hard seek for large drift
  videoEl.currentTime = targetTime;
  videoEl.playbackRate = 1.0;
  correcting = false;
}

/** For testing */
export function _isCorrecting() {
  return correcting;
}
