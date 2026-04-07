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

    const onReady = () => {
      // Could check if ALL are ready, but buffer:all-ready handles that
    };

    const onAllReady = () => {
      setWaitingFor(null);
      setShowSkip(false);
      clearTimeout(timeoutId);
    };

    socket.on('buffer:waiting', onWaiting);
    socket.on('buffer:ready', onReady);
    socket.on('buffer:all-ready', onAllReady);

    return () => {
      socket.off('buffer:waiting', onWaiting);
      socket.off('buffer:ready', onReady);
      socket.off('buffer:all-ready', onAllReady);
      clearTimeout(timeoutId);
    };
  }, []);

  if (!waitingFor) return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
      <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-yellow-400 text-lg">Ожидание {waitingFor}...</p>
      {showSkip && (
        <button
          onClick={() => setWaitingFor(null)}
          className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
        >
          Продолжить без ожидания
        </button>
      )}
    </div>
  );
}
