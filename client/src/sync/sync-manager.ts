import { socket } from '../lib/socket';
import { getServerTime } from './time-sync';
import type { SyncPacket } from 'shared/types';

let videoEl: HTMLVideoElement | null = null;
let isRemoteAction = false;
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
  if (isRemoteAction) return;
  sendPacket('play');
}

function onLocalPause() {
  if (isRemoteAction) return;
  sendPacket('pause');
}

function onLocalSeek() {
  if (isRemoteAction) return;
  sendPacket('seek');
}

function onRemotePacket(packet: SyncPacket) {
  if (!videoEl) return;

  isRemoteAction = true;

  switch (packet.type) {
    case 'play':
      videoEl.currentTime = packet.time;
      videoEl.play().catch(() => {});
      break;
    case 'pause':
      videoEl.currentTime = packet.time;
      videoEl.pause();
      break;
    case 'seek':
      videoEl.currentTime = packet.time;
      break;
    case 'sync':
      // Handled by drift correction (Stage 5)
      break;
  }

  // Reset flag after a tick to allow browser events to fire
  setTimeout(() => {
    isRemoteAction = false;
  }, 50);
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
  return isRemoteAction;
}
