import { socket } from '../lib/socket';
import { getServerTime } from './time-sync';
import type { SyncPacket } from 'shared/types';

let videoEl: HTMLVideoElement | null = null;
let remoteActionDepth = 0;
let enabled = false;

export function attachVideo(el: HTMLVideoElement) {
  detachVideo();
  videoEl = el;

  el.addEventListener('play', onLocalPlay);
  el.addEventListener('pause', onLocalPause);
  el.addEventListener('seeked', onLocalSeek);

  socket.on('sync:packet', onRemotePacket);
  socket.on('sync:request-state', onStateRequest);
  enabled = true;
}

export function detachVideo() {
  if (videoEl) {
    videoEl.removeEventListener('play', onLocalPlay);
    videoEl.removeEventListener('pause', onLocalPause);
    videoEl.removeEventListener('seeked', onLocalSeek);
  }
  socket.off('sync:packet', onRemotePacket);
  socket.off('sync:request-state', onStateRequest);
  videoEl = null;
  enabled = false;
  remoteActionDepth = 0;
}

/** Begin a remote-originated action — local events will be suppressed during the window. */
export function beginRemoteAction(windowMs = 300) {
  remoteActionDepth++;
  setTimeout(() => {
    remoteActionDepth = Math.max(0, remoteActionDepth - 1);
  }, windowMs);
}

function isRemote(): boolean {
  return remoteActionDepth > 0;
}

function sendPacket(type: SyncPacket['type']) {
  if (!videoEl || !enabled) return;
  const packet: SyncPacket = {
    type,
    time: videoEl.currentTime,
    serverTimestamp: getServerTime(),
    userId: socket.id || '',
  };
  socket.emit('sync:packet', packet);
}

function onLocalPlay() {
  if (isRemote()) return;
  sendPacket('play');
}

function onLocalPause() {
  if (isRemote()) return;
  sendPacket('pause');
}

function onLocalSeek() {
  if (isRemote()) return;
  sendPacket('seek');
}

function onRemotePacket(packet: SyncPacket) {
  if (!videoEl) return;

  switch (packet.type) {
    case 'play': {
      beginRemoteAction();
      // On play, only seek if significantly out of sync (>1s).
      // Smaller drift will be corrected smoothly by drift correction.
      if (Math.abs(videoEl.currentTime - packet.time) > 1) {
        videoEl.currentTime = packet.time;
      }
      videoEl.play().catch(() => {});
      break;
    }
    case 'pause': {
      beginRemoteAction();
      // On pause, always align time exactly — drift correction doesn't run while paused.
      // The 300ms remote-action window suppresses the resulting 'seeked' echo.
      if (Math.abs(videoEl.currentTime - packet.time) > 0.05) {
        videoEl.currentTime = packet.time;
      }
      videoEl.pause();
      break;
    }
    case 'seek': {
      beginRemoteAction();
      videoEl.currentTime = packet.time;
      break;
    }
    case 'sync':
      // Handled by drift correction
      break;
  }
}

function onStateRequest(_data: unknown, callback: (state: SyncPacket) => void) {
  if (!videoEl) return;
  callback({
    type: videoEl.paused ? 'pause' : 'play',
    time: videoEl.currentTime,
    serverTimestamp: getServerTime(),
    userId: socket.id || '',
  });
}

/** For testing */
export function _getIsRemoteAction() {
  return isRemote();
}
