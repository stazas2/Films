import { useRef, useEffect, useCallback, useState } from 'react';
// iOS Safari uses webkit-prefixed fullscreen APIs on older versions.
interface FullscreenDoc extends Document {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
}
interface FullscreenEl extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const container = containerRef.current as FullscreenEl | null;
    if (!container) return;
    const doc = document as FullscreenDoc;
    const nativeActive = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (nativeActive) {
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
      return;
    }
    // No native fullscreen active — but we might be in CSS pseudo-fullscreen (iOS fallback).
    setIsFullscreen((prev) => {
      if (prev) return false; // exit pseudo-fullscreen
      const req =
        container.requestFullscreen?.bind(container) ||
        container.webkitRequestFullscreen?.bind(container);
      if (req) {
        req().catch(() => {
          // Browser denied native fullscreen — fall back to CSS pseudo-fullscreen.
          setIsFullscreen(true);
        });
        return prev; // fullscreenchange event will flip the state on success
      }
      // iOS Safari < 16.4: no element fullscreen API → use CSS pseudo-fullscreen.
      return true;
    });
  }, []);

  // Sync isFullscreen state with browser fullscreen changes (including ESC / swipe exit).
  useEffect(() => {
    const onChange = () => {
      const doc = document as FullscreenDoc;
      const active = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(active);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // Auto-hide controls after inactivity in fullscreen. Show on any pointer activity.
  const scheduleHideControls = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isFullscreen) return;
    const video = videoRef.current;
    if (!video || video.paused) return;
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, [isFullscreen]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  useEffect(() => {
    if (!isFullscreen) {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      return;
    }
    showControls();
    const video = videoRef.current;
    if (!video) return;
    const onPause = () => {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    const onPlay = () => scheduleHideControls();
    video.addEventListener('pause', onPause);
    video.addEventListener('play', onPlay);
    return () => {
      video.removeEventListener('pause', onPause);
      video.removeEventListener('play', onPlay);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isFullscreen, showControls, scheduleHideControls]);

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

  const hideControlsNow = isFullscreen && !controlsVisible;
  const containerClass = isFullscreen
    ? `fixed inset-0 z-50 flex flex-col bg-black ${hideControlsNow ? 'cursor-none' : ''}`
    : 'rounded-lg overflow-hidden border border-gray-800 bg-black';
  const videoWrapperClass = isFullscreen
    ? 'relative flex-1 min-h-0 bg-gray-900'
    : 'relative aspect-video bg-gray-900';
  const videoClass = isFullscreen ? 'w-full h-full object-contain' : 'w-full h-full';
  const controlsClass = isFullscreen
    ? `transition-opacity duration-200 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
    : '';

  return (
    <div
      ref={containerRef}
      className={containerClass}
      onMouseMove={isFullscreen ? showControls : undefined}
      onTouchStart={isFullscreen ? showControls : undefined}
    >
      <div className={videoWrapperClass}>
        <video
          ref={videoRef}
          className={videoClass}
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
      {src && (
        <div className={controlsClass}>
          <PlayerControls videoRef={videoRef} onToggleFullscreen={toggleFullscreen} />
        </div>
      )}
    </div>
  );
}
