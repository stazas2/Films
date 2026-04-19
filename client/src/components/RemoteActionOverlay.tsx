import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { usePlayerStore } from '../store/player';
import type { SyncPacket } from 'shared/types';

interface Transient {
  id: number;
  text: string;
  icon: 'play' | 'seek';
}

let actionSeq = 0;

export default function RemoteActionOverlay() {
  const [pausedBy, setPausedBy] = useState<string | null>(null);
  const [transient, setTransient] = useState<Transient | null>(null);
  const playing = usePlayerStore((s) => s.playing);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onPacket = (packet: SyncPacket) => {
      if (packet.userId === socket.id) return;
      const name = packet.userName || 'Кто-то';

      if (packet.type === 'pause') {
        setPausedBy(name);
        setTransient(null);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        return;
      }

      if (packet.type === 'play') {
        setPausedBy(null);
        const next: Transient = { id: ++actionSeq, text: `${name} продолжил просмотр`, icon: 'play' };
        setTransient(next);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setTransient((curr) => (curr?.id === next.id ? null : curr));
        }, 2200);
        return;
      }

      if (packet.type === 'seek') {
        const next: Transient = { id: ++actionSeq, text: `${name} перемотал`, icon: 'seek' };
        setTransient(next);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setTransient((curr) => (curr?.id === next.id ? null : curr));
        }, 2200);
      }
    };

    socket.on('sync:packet', onPacket);
    return () => {
      socket.off('sync:packet', onPacket);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Clear the paused-by label as soon as local playback resumes (either from
  // a remote play packet or the user clicking play themselves).
  useEffect(() => {
    if (playing) setPausedBy(null);
  }, [playing]);

  const showPersistent = pausedBy && !playing;
  const showTransient = transient && !showPersistent;

  return (
    <>
      {showPersistent && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 glass rounded-full text-[13px] text-ink-50 pointer-events-none z-20 shadow-card animate-fade-in">
          <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
          </svg>
          <span>
            <span className="font-medium text-amber-400">{pausedBy}</span> поставил паузу
          </span>
        </div>
      )}
      {showTransient && (
        <div
          key={transient.id}
          className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 glass rounded-full text-[13px] text-ink-50 pointer-events-none z-20 animate-[fadeInOut_2.2s_ease-in-out_forwards] shadow-card"
        >
          {transient.icon === 'play' && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {transient.icon === 'seek' && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 5v14l8-7zM14 5v14l8-7z" />
            </svg>
          )}
          <span>{transient.text}</span>
        </div>
      )}
    </>
  );
}
