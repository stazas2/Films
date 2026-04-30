import { useRef, useState, useEffect } from 'react';
import { usePlayerStore } from '../store/player';

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onToggleFullscreen: () => void;
  onQualityChange?: (level: number) => void;
}

const ACCENT = '#f5b544';
const TRACK = 'rgba(255,255,255,0.12)';

function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  className,
  accentColor = ACCENT,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  accentColor?: string;
}) {
  const percent = max > 0 ? (value / max) * 100 : 0;

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={className}
      style={{
        background: `linear-gradient(to right, ${accentColor} ${percent}%, ${TRACK} ${percent}%)`,
      }}
    />
  );
}

function SeekBar({
  duration,
  currentTime,
  onSeek,
}: {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [previewX, setPreviewX] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  // Keep trackWidth in sync so percentages are accurate across fullscreen/resize
  useEffect(() => {
    if (!wrapperRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setTrackWidth(entry.contentRect.width);
    });
    obs.observe(wrapperRef.current);
    setTrackWidth(wrapperRef.current.clientWidth);
    return () => obs.disconnect();
  }, []);

  const safeDuration = duration > 0 && isFinite(duration) ? duration : 0;
  const progressPercent = safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;

  const localX = (clientX: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(rect.width, clientX - rect.left));
  };

  const timeAt = (x: number) => (trackWidth > 0 && safeDuration > 0 ? (x / trackWidth) * safeDuration : 0);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (safeDuration === 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    const x = localX(e.clientX);
    setPreviewX(x);
    onSeek(timeAt(x));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const x = localX(e.clientX);
    setPreviewX(x);
    if (dragging && safeDuration > 0) onSeek(timeAt(x));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setDragging(false);
    // On touch devices, clear preview after release; on mouse, hover keeps it until leave
    if (e.pointerType !== 'mouse') setPreviewX(null);
  };

  const onPointerLeave = () => {
    if (!dragging) setPreviewX(null);
  };

  const previewTime = previewX != null ? timeAt(previewX) : null;
  // Clamp tooltip position so it doesn't overflow the bar edges
  const tooltipLeft =
    previewX != null && trackWidth > 0
      ? Math.max(28, Math.min(trackWidth - 28, previewX))
      : 0;

  return (
    <div
      ref={wrapperRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      className="relative py-2.5 cursor-pointer group touch-none select-none"
    >
      {/* Track */}
      <div
        className={`relative rounded-full bg-white/[0.14] transition-[height] ${
          previewX != null || dragging ? 'h-1.5' : 'h-1 group-hover:h-1.5'
        }`}
      >
        {/* Hover/drag preview fill */}
        {previewX != null && (
          <div
            className="absolute inset-y-0 left-0 bg-white/25 rounded-full pointer-events-none"
            style={{ width: `${previewX}px` }}
          />
        )}
        {/* Current progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-amber-400 rounded-full pointer-events-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Thumb */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-amber-400 pointer-events-none transition-all ${
          dragging ? 'w-4 h-4 shadow-[0_0_0_6px_rgba(245,181,68,0.25)]' : 'w-3 h-3 shadow-[0_0_0_4px_rgba(245,181,68,0.2)] opacity-0 group-hover:opacity-100'
        }`}
        style={{ left: `calc(${progressPercent}% - ${dragging ? 8 : 6}px)` }}
      />

      {/* Tooltip */}
      {previewTime != null && trackWidth > 0 && (
        <div
          className="absolute bottom-full mb-3 px-2 py-1 rounded-md bg-black/95 border border-white/15 text-ink-50 text-xs font-mono tabular-nums pointer-events-none whitespace-nowrap shadow-card z-30"
          style={{ left: `${tooltipLeft}px`, transform: 'translateX(-50%)' }}
        >
          {formatTime(previewTime)}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-black/95"
          />
        </div>
      )}
    </div>
  );
}

function IconButton({
  onClick,
  label,
  children,
  className = '',
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center text-ink-100 hover:text-amber-400 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

function QualityMenu({
  levels,
  currentLevel,
  playingLevel,
  onChange,
}: {
  levels: { height: number; bitrate: number }[];
  currentLevel: number;
  playingLevel: number;
  onChange: (level: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Only show the menu when there's a real choice: at least 2 levels with known heights.
  // Media playlists (no #EXT-X-STREAM-INF) get a single level with height=0 — useless to surface.
  const realLevels = levels
    .map((l, i) => ({ ...l, idx: i }))
    .filter((l) => l.height > 0);
  if (realLevels.length < 2) return null;

  // Sort by height descending so 1080p comes first; preserve original index for HLS.
  const sorted = realLevels.sort((a, b) => b.height - a.height);

  const currentLabel =
    currentLevel === -1
      ? playingLevel >= 0 && levels[playingLevel]
        ? `Авто · ${levels[playingLevel].height || '?'}p`
        : 'Авто'
      : levels[currentLevel]
        ? `${levels[currentLevel].height || '?'}p`
        : '?';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Качество"
        title="Качество"
        className="flex items-center gap-1 px-2 h-8 rounded-md text-ink-100 hover:text-amber-400 transition-colors text-xs font-mono tabular-nums"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{currentLabel}</span>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 min-w-[140px] rounded-lg bg-black/95 border border-white/10 shadow-card z-30 py-1 animate-fade-in">
          <button
            onClick={() => {
              onChange(-1);
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
              currentLevel === -1 ? 'text-amber-400' : 'text-ink-100 hover:text-amber-400 hover:bg-white/[0.04]'
            }`}
          >
            <span>Авто</span>
            {currentLevel === -1 && playingLevel >= 0 && levels[playingLevel] && (
              <span className="text-[10px] text-ink-300 font-mono">
                {levels[playingLevel].height || '?'}p
              </span>
            )}
          </button>
          <div className="h-px bg-white/5 my-1" />
          {sorted.map((l) => (
            <button
              key={l.idx}
              onClick={() => {
                onChange(l.idx);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                currentLevel === l.idx ? 'text-amber-400' : 'text-ink-100 hover:text-amber-400 hover:bg-white/[0.04]'
              }`}
            >
              <span>{l.height ? `${l.height}p` : 'audio'}</span>
              <span className="text-[10px] text-ink-400 font-mono ml-3">
                {l.bitrate ? `${Math.round(l.bitrate / 1000)}k` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlayerControls({ videoRef, onToggleFullscreen, onQualityChange }: Props) {
  const { playing, currentTime, duration, volume, muted, buffering, levels, currentLevel, playingLevel } = usePlayerStore();

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const handleSeek = (val: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = val;
  };

  const handleVolume = (val: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    video.muted = false;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  };

  const volumeSliderClass =
    'w-20 h-1 rounded-full appearance-none cursor-pointer ' +
    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer ' +
    '[&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0';

  const VolumeIcon = () => {
    if (muted || volume === 0) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    );
  };

  return (
    <div className="relative z-20 px-4 pt-6 pb-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent space-y-1">
      {/* Seek bar with hover/scrub tooltip */}
      <SeekBar duration={duration} currentTime={currentTime} onSeek={handleSeek} />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <IconButton onClick={togglePlay} label={playing ? 'Пауза' : 'Играть'} className="w-9 h-9">
            {buffering ? (
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : playing ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </IconButton>

          {/* Skip */}
          <IconButton onClick={() => skip(-10)} label="-10 секунд" className="w-8 h-8">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </IconButton>
          <IconButton onClick={() => skip(10)} label="+10 секунд" className="w-8 h-8">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </IconButton>

          {/* Time */}
          <span className="text-ink-200 text-xs font-mono tabular-nums">
            <span className="text-ink-50">{formatTime(currentTime)}</span>
            <span className="text-ink-400 mx-1">/</span>
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Volume */}
          <div className="flex items-center gap-2 group">
            <IconButton onClick={toggleMute} label="Звук" className="w-8 h-8">
              <VolumeIcon />
            </IconButton>
            <RangeSlider
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolume}
              className={volumeSliderClass}
              accentColor="#ffffff"
            />
          </div>

          {/* Quality (component itself decides whether to render based on real level count) */}
          {onQualityChange && (
            <QualityMenu
              levels={levels}
              currentLevel={currentLevel}
              playingLevel={playingLevel}
              onChange={onQualityChange}
            />
          )}

          {/* Fullscreen */}
          <IconButton onClick={onToggleFullscreen} label="Полный экран" className="w-8 h-8 ml-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </IconButton>
        </div>
      </div>
    </div>
  );
}
