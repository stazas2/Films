import { useRef } from 'react';
import { usePlayerStore } from '../store/player';

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onToggleFullscreen: () => void;
}

function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  className,
  accentColor = '#3b82f6',
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
        background: `linear-gradient(to right, ${accentColor} ${percent}%, #374151 ${percent}%)`,
      }}
    />
  );
}

export default function PlayerControls({ videoRef, onToggleFullscreen }: Props) {
  const { playing, currentTime, duration, volume, muted, buffering } = usePlayerStore();
  const seekingRef = useRef(false);

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

  return (
    <div className="bg-gray-900/90 px-4 py-2 space-y-2">
      {/* Seek bar */}
      <RangeSlider
        min={0}
        max={duration || 100}
        step={0.5}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer"
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white hover:text-blue-400 text-lg w-8">
            {buffering ? '...' : playing ? '⏸' : '▶'}
          </button>

          {/* Skip buttons */}
          <button onClick={() => skip(-10)} className="text-gray-400 hover:text-white text-sm">
            -10s
          </button>
          <button onClick={() => skip(10)} className="text-gray-400 hover:text-white text-sm">
            +10s
          </button>

          {/* Time */}
          <span className="text-gray-400 text-sm font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Volume */}
          <button onClick={toggleMute} className="text-gray-400 hover:text-white text-sm">
            {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <RangeSlider
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={handleVolume}
            className="w-20 h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer"
          />

          {/* Fullscreen */}
          <button onClick={onToggleFullscreen} className="text-gray-400 hover:text-white text-sm ml-1">
            ⛶
          </button>
        </div>
      </div>
    </div>
  );
}
