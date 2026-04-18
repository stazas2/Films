import { useState, useCallback, useEffect } from 'react';
import { useRoomStore } from '../store/room';
import { useRoom } from '../hooks/useRoom';
import Player from '../components/Player';
import LinkInput from '../components/LinkInput';
import Chat from '../components/Chat';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name: string): string {
  const palette = ['#f5b544', '#8b5cf6', '#22c55e', '#ec4899', '#38bdf8', '#f97316', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export default function Room() {
  const { code, users, userName, videoUrl, connected, isHost, justCreated, clearJustCreated } = useRoomStore();
  const { sendVideoUrl } = useRoom();
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(() => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  useEffect(() => {
    if (!justCreated || !code) return;
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {})
      .finally(() => clearJustCreated());
  }, [justCreated, code, clearJustCreated]);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-5 space-y-5 animate-fade-in">
        {/* Header */}
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-ink-300 font-medium">Код комнаты</div>
              <button
                onClick={copyCode}
                className="group relative font-mono text-2xl font-semibold tracking-[0.3em] text-ink-50 hover:text-amber-400 transition-colors"
                title="Скопировать код"
              >
                {code}
                <span
                  className={`absolute -bottom-6 left-0 text-[11px] font-sans tracking-normal text-amber-400 transition-opacity ${
                    copied ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  ✓ Скопировано
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5">
              <span className="relative flex h-2 w-2">
                {connected && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60 animate-ping" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    connected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
              </span>
              <span className="text-xs text-ink-200">
                {connected ? 'Онлайн' : 'Переподключение...'}
              </span>
            </div>
            <span className="text-sm text-ink-100">
              <span className="text-ink-300">ты —</span> {userName}
            </span>
          </div>
        </header>

        {/* Users */}
        <div className="flex gap-2 flex-wrap">
          {users.map((user) => {
            const color = avatarColor(user.name);
            return (
              <div
                key={user.id}
                className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full bg-white/[0.03] border border-white/5 text-sm"
              >
                <div
                  className="relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-ink-950"
                  style={{ backgroundColor: color }}
                >
                  {initials(user.name)}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-950 ${
                      user.status === 'watching'
                        ? 'bg-green-500'
                        : user.status === 'buffering'
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-red-500'
                    }`}
                  />
                </div>
                <span className="text-ink-100">{user.name}</span>
                {user.isHost && (
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">хост</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Link input (only host) */}
        {isHost && <LinkInput onSubmit={sendVideoUrl} />}

        {/* Player + Chat layout */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <Player src={videoUrl} />
          </div>
          <div className="lg:w-96 flex-shrink-0">
            <Chat />
          </div>
        </div>
      </div>
    </div>
  );
}
