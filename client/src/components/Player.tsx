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
import RemoteActionOverlay from './RemoteActionOverlay';

interface Props {
  src: string | null;
}

function describeHlsError(data: any): string {
  const status = data?.response?.code;
  const details = data?.details;

  if (details === 'manifestLoadError' || details === 'levelLoadError' || details === 'fragLoadError') {
    if (status === 403) {
      return 'Ссылка недействительна (403): стрим часто привязан к IP того, кто её получил, или срок действия истёк. Попробуй получить ссылку заново.';
    }
    if (status === 404) {
      return 'Видео не найдено (404). Проверь ссылку.';
    }
    if (status === 401) {
      return 'Нужна авторизация (401). Эта ссылка требует куки/токен из исходного сайта.';
    }
    if (status && status >= 500) {
      return `Сервер видео недоступен (${status}). Попробуй позже или другую ссылку.`;
    }
    if (status && status >= 400) {
      return `Ошибка загрузки видео (${status}).`;
    }
    return 'Не удалось загрузить видео. Проверь ссылку и интернет-соединение.';
  }

  if (details === 'manifestParsingError' || details === 'manifestIncompatibleCodecsError') {
    return 'Неподдерживаемый формат плейлиста. Ожидается HLS (.m3u8).';
  }

  if (data?.type === 'networkError') {
    return 'Сетевая ошибка. Проверь интернет и попробуй снова.';
  }

  if (data?.type === 'mediaError') {
    return 'Ошибка декодирования видео. Формат, возможно, не поддерживается браузером.';
  }

  return 'Не удалось воспроизвести видео. Попробуй другую ссылку.';
}

export default function Player({ src }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const store = usePlayerStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

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
    store.resetQuality();

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

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const lvls = hls.levels.map((l) => ({ height: l.height, bitrate: l.bitrate }));
        store.setLevels(lvls);
        store.setCurrentLevel(hls.currentLevel ?? -1);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        store.setPlayingLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          store.setError(describeHlsError(data));
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

  const handleQualityChange = useCallback((level: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = level;
    store.setCurrentLevel(level);
  }, []);

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
    ? `fixed inset-0 z-50 bg-black ${hideControlsNow ? 'cursor-none' : ''}`
    : 'relative rounded-2xl overflow-hidden bg-black border border-white/5 shadow-card';
  const videoWrapperClass = isFullscreen
    ? 'relative w-full h-full bg-black'
    : 'relative aspect-video bg-black';
  const videoClass = 'w-full h-full object-contain';
  const controlsWrapperClass = `absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-200 ${
    controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
  }`;

  return (
    <div
      ref={containerRef}
      className={containerClass}
      onMouseMove={isFullscreen ? showControls : undefined}
      onTouchStart={isFullscreen ? showControls : undefined}
    >
      <div className={videoWrapperClass}>
        <video ref={videoRef} className={videoClass} playsInline />
        {!src && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/5">
              <svg className="w-7 h-7 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-ink-100 text-base font-medium">Готов к просмотру</p>
            <p className="text-ink-300 text-sm mt-1 max-w-xs">
              Хост может вставить .m3u8 ссылку выше, и поехали
            </p>
          </div>
        )}
        {src && !store.error && <BufferOverlay />}
        {src && !store.error && <RemoteActionOverlay />}
        {store.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm z-20 animate-fade-in">
            <div className="max-w-md mx-4 p-6 rounded-2xl glass shadow-card">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-ink-50 font-semibold mb-1">Не получилось загрузить</h3>
                  <p className="text-ink-200 text-sm leading-relaxed">{store.error}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {src && store.buffering && !store.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <div className="w-10 h-10 border-[3px] border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}
        {isFullscreen && src && (
          <div className={controlsWrapperClass}>
            <PlayerControls videoRef={videoRef} onToggleFullscreen={toggleFullscreen} onQualityChange={handleQualityChange} />
          </div>
        )}
      </div>
      {!isFullscreen && src && (
        <PlayerControls videoRef={videoRef} onToggleFullscreen={toggleFullscreen} onQualityChange={handleQualityChange} />
      )}
    </div>
  );
}
