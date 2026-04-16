import { useRef, useEffect, useCallback, useState } from 'react';
import Hls from 'hls.js';
import { usePlayerStore } from '../store/player';
import { useSync } from '../hooks/useSync';
import { socket } from '../lib/socket';
import PlayerControls from './PlayerControls';
import BufferOverlay from './BufferOverlay';

interface Props {
  src: string | null;
}

export default function Player({ src }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const store = usePlayerStore();

  // Sync playback with room
  useSync(videoRef);

  // Initialize HLS when src changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Clean up previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    store.setError(null);

    // Proxy the source URL through our server
    const proxiedSrc = `/api/proxy?url=${encodeURIComponent(src)}`;

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr, url) => {
          // URLs already rewritten by proxy to /api/proxy?url=...
          xhr.open('GET', url, true);
        },
      });

      hls.loadSource(proxiedSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          store.setError(`Ошибка воспроизведения: ${data.type}`);
          console.error('HLS fatal error:', data);
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = proxiedSrc;
    } else {
      store.setError('HLS не поддерживается в этом браузере');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  // Bind video events to store
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Debounce buffer:state emits so a flapping waiting/playing cycle on a shaky
    // connection doesn't hammer the rate limiter. UI updates stay immediate.
    let pendingBufferState: boolean | null = null;
    let lastSentBufferState: boolean | null = null;
    let bufferTimer: ReturnType<typeof setTimeout> | null = null;
    const flushBufferState = () => {
      bufferTimer = null;
      if (pendingBufferState === null) return;
      if (pendingBufferState !== lastSentBufferState) {
        socket.emit('buffer:state', { buffering: pendingBufferState });
        lastSentBufferState = pendingBufferState;
      }
      pendingBufferState = null;
    };
    const scheduleBufferEmit = (buffering: boolean) => {
      pendingBufferState = buffering;
      if (bufferTimer) return;
      bufferTimer = setTimeout(flushBufferState, 500);
    };

    const onPlay = () => store.setPlaying(true);
    const onPause = () => store.setPlaying(false);
    const onTimeUpdate = () => {
      store.setCurrentTime(video.currentTime);
      // Also update duration on timeupdate — HLS may not fire durationchange reliably
      if (video.duration && isFinite(video.duration)) {
        store.setDuration(video.duration);
      }
    };
    const onDurationChange = () => {
      if (video.duration && isFinite(video.duration)) {
        store.setDuration(video.duration);
      }
    };
    const onLoadedMetadata = () => {
      if (video.duration && isFinite(video.duration)) {
        store.setDuration(video.duration);
      }
    };
    const onVolumeChange = () => {
      store.setVolume(video.volume);
      store.setMuted(video.muted);
    };
    const onWaiting = () => {
      console.log('[buffer] waiting');
      store.setBuffering(true);
      scheduleBufferEmit(true);
    };
    const onPlaying = () => {
      console.log('[buffer] playing');
      store.setBuffering(false);
      scheduleBufferEmit(false);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      if (bufferTimer) clearTimeout(bufferTimer);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isFinite(video.duration))
            video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          video.muted = !video.muted;
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleFullscreen]);

  return (
    <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-800 bg-black">
      <div className="relative aspect-video bg-gray-900">
        <video
          ref={videoRef}
          className="w-full h-full"
          playsInline
        />
        {!src && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500">Вставьте ссылку на видео для начала просмотра</p>
          </div>
        )}
        {src && <BufferOverlay />}
        {store.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="text-red-400 text-center px-4">{store.error}</p>
          </div>
        )}
        {src && store.buffering && !store.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {src && <PlayerControls videoRef={videoRef} onToggleFullscreen={toggleFullscreen} />}
    </div>
  );
}
