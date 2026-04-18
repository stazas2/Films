import { useState, useEffect } from 'react';
import { socket } from '../lib/socket';
import { BUFFER_TIMEOUT_MS } from 'shared/constants';

export default function BufferOverlay() {
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const onWaiting = (data: { userName: string }) => {
      setWaitingFor(data.userName);
      setShowSkip(false);
      timeoutId = setTimeout(() => setShowSkip(true), BUFFER_TIMEOUT_MS);
    };

    const onAllReady = () => {
      setWaitingFor(null);
      setShowSkip(false);
      clearTimeout(timeoutId);
    };

    socket.on('buffer:waiting', onWaiting);
    socket.on('buffer:all-ready', onAllReady);

    return () => {
      socket.off('buffer:waiting', onWaiting);
      socket.off('buffer:all-ready', onAllReady);
      clearTimeout(timeoutId);
    };
  }, []);

  if (!waitingFor) return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10 animate-fade-in">
      <div className="relative flex items-center justify-center w-14 h-14 mb-4">
        <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
        <div className="relative w-10 h-10 border-[3px] border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
      <p className="text-ink-50 text-base font-medium">
        Ждём <span className="text-amber-400">{waitingFor}</span>
      </p>
      <p className="text-ink-300 text-xs mt-1">Подгружается видео...</p>
      {showSkip && (
        <button
          onClick={() => setWaitingFor(null)}
          className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-ink-100 transition-colors"
        >
          Продолжить без ожидания
        </button>
      )}
    </div>
  );
}
