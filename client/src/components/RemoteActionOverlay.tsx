import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import type { SyncPacket } from 'shared/types';

interface Action {
  id: number;
  text: string;
  icon: 'pause' | 'play' | 'seek';
}

let actionSeq = 0;

function describe(packet: SyncPacket): Action | null {
  const name = packet.userName || 'Кто-то';
  switch (packet.type) {
    case 'pause':
      return { id: ++actionSeq, text: `${name} поставил паузу`, icon: 'pause' };
    case 'play':
      return { id: ++actionSeq, text: `${name} продолжил просмотр`, icon: 'play' };
    case 'seek':
      return { id: ++actionSeq, text: `${name} перемотал`, icon: 'seek' };
    default:
      return null;
  }
}

export default function RemoteActionOverlay() {
  const [action, setAction] = useState<Action | null>(null);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;

    const onPacket = (packet: SyncPacket) => {
      if (packet.userId === socket.id) return;
      const next = describe(packet);
      if (!next) return;
      setAction(next);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        setAction((current) => (current?.id === next.id ? null : current));
      }, 2200);
    };

    socket.on('sync:packet', onPacket);
    return () => {
      socket.off('sync:packet', onPacket);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!action) return null;

  return (
    <div
      key={action.id}
      className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 glass rounded-full text-[13px] text-ink-50 pointer-events-none z-20 animate-[fadeInOut_2.2s_ease-in-out_forwards] shadow-card"
    >
      {action.icon === 'pause' && (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
        </svg>
      )}
      {action.icon === 'play' && (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
      {action.icon === 'seek' && (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4 5v14l8-7zM14 5v14l8-7z" />
        </svg>
      )}
      <span>{action.text}</span>
    </div>
  );
}
