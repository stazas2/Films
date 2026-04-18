import { useState, useEffect } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useRoomStore } from '../store/room';

export default function Home() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const { createRoom, joinRoom } = useRoom();
  const { rejoinError, setRejoinError } = useRoomStore();

  useEffect(() => {
    if (!rejoinError) return;
    const t = setTimeout(() => setRejoinError(null), 5000);
    return () => clearTimeout(t);
  }, [rejoinError, setRejoinError]);

  const handleCreate = () => {
    if (!name.trim()) return;
    createRoom(name.trim());
  };

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim()) return;
    joinRoom(roomCode.trim().toUpperCase(), name.trim());
  };

  const canSubmit =
    mode === 'create' ? !!name.trim() : !!name.trim() && roomCode.trim().length >= 4;

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-400/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      {/* Rejoin-failed toast */}
      {rejoinError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 glass rounded-xl px-4 py-3 shadow-card animate-rise-in max-w-sm">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-50">Комната больше не доступна</p>
              <p className="text-xs text-ink-200 mt-0.5">{rejoinError}</p>
            </div>
            <button
              onClick={() => setRejoinError(null)}
              className="text-ink-300 hover:text-ink-50 transition-colors"
              aria-label="Закрыть"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-10 animate-rise-in">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-ink-200">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
            Синхронный просмотр
          </div>
          <h1 className="font-display text-6xl leading-[0.95] tracking-tight text-balance">
            Смотри вместе,
            <br />
            <span className="italic text-amber-400">где бы</span> вы ни были
          </h1>
          <p className="text-ink-200 text-[15px] leading-relaxed max-w-sm mx-auto text-balance">
            Создай комнату, кинь другу ссылку — и включайте фильм на одной секунде.
          </p>
        </div>

        {/* Auth card */}
        <div className="glass rounded-2xl p-6 space-y-5 shadow-card">
          {/* Segmented toggle */}
          <div className="relative grid grid-cols-2 p-1 rounded-xl bg-black/30 border border-white/5 text-sm">
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white/[0.06] border border-white/10 transition-transform duration-300 ease-out"
              style={{ transform: mode === 'create' ? 'translateX(4px)' : 'translateX(calc(100% + 4px))' }}
            />
            <button
              onClick={() => setMode('create')}
              className={`relative z-10 py-2 font-medium transition-colors ${
                mode === 'create' ? 'text-ink-50' : 'text-ink-300 hover:text-ink-100'
              }`}
            >
              Создать
            </button>
            <button
              onClick={() => setMode('join')}
              className={`relative z-10 py-2 font-medium transition-colors ${
                mode === 'join' ? 'text-ink-50' : 'text-ink-300 hover:text-ink-100'
              }`}
            >
              Войти
            </button>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-ink-200 ml-1 mb-1.5 block uppercase tracking-wider">
                Имя
              </span>
              <input
                type="text"
                placeholder="Как тебя зовут?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="field"
              />
            </label>

            {mode === 'join' && (
              <label className="block animate-fade-in">
                <span className="text-xs font-medium text-ink-200 ml-1 mb-1.5 block uppercase tracking-wider">
                  Код комнаты
                </span>
                <input
                  type="text"
                  placeholder="••••••"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  maxLength={6}
                  className="field font-mono tracking-[0.4em] text-center text-xl uppercase"
                />
              </label>
            )}
          </div>

          <button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={!canSubmit}
            className="btn-primary w-full text-base flex items-center justify-center gap-2"
          >
            {mode === 'create' ? (
              <>
                Создать комнату
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            ) : (
              'Войти в комнату'
            )}
          </button>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-ink-300">
          HLS-потоки, YouTube скоро · синхронизация &lt; 200мс
        </p>
      </div>
    </div>
  );
}
