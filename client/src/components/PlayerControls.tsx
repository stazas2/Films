import { usePlayerStore } from '../store/player';

function formatTime(seconds: number): string {
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

export default function PlayerControls({ videoRef, onToggleFullscreen }: Props) {
  const { playing, currentTime, duration, volume, muted, buffering } = usePlayerStore();

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(e.target.value);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Number(e.target.value);
    video.muted = false;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  };

  return (
    <div className="bg-gray-900/90 px-4 py-2 space-y-2">
      {/* Seek bar */}
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1 accent-blue-500 cursor-pointer"
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
            {muted || volume === 0 ? '🔇' : '🔊'}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={handleVolume}
            className="w-20 h-1 accent-blue-500 cursor-pointer"
          />

          {/* Fullscreen */}
          <button onClick={onToggleFullscreen} className="text-gray-400 hover:text-white text-sm">
            ⛶
          </button>
        </div>
      </div>
    </div>
  );
}
