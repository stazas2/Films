import { useState, useCallback } from 'react';
import { useRoomStore } from '../store/room';
import { useRoom } from '../hooks/useRoom';
import Player from '../components/Player';
import LinkInput from '../components/LinkInput';
import Chat from '../components/Chat';

export default function Room() {
  const { code, users, userName, videoUrl, connected, isHost } = useRoomStore();
  const { sendVideoUrl } = useRoom();
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(() => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Комната:</h1>
            <button
              onClick={copyCode}
              className="font-mono text-blue-400 hover:text-blue-300 text-xl transition-colors relative"
              title="Скопировать код"
            >
              {code}
              {copied && (
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-green-600 text-white px-2 py-0.5 rounded whitespace-nowrap">
                  Скопировано!
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">
                {connected ? 'Подключён' : 'Отключён'}
              </span>
            </div>
            <span className="text-gray-400">{userName}</span>
          </div>
        </div>

        {/* Участники */}
        <div className="flex gap-2 flex-wrap">
          {users.map((user) => (
            <div
              key={user.id}
              className={`px-3 py-1 rounded-full text-sm flex items-center gap-1.5 ${
                user.isHost ? 'bg-blue-600/80' : 'bg-gray-700/80'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  user.status === 'watching'
                    ? 'bg-green-400'
                    : user.status === 'buffering'
                      ? 'bg-yellow-400 animate-pulse'
                      : 'bg-red-400'
                }`}
              />
              {user.name} {user.isHost && '(хост)'}
            </div>
          ))}
        </div>

        {/* Link input (only host) */}
        {isHost && <LinkInput onSubmit={sendVideoUrl} />}

        {/* Player + Chat layout */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <Player src={videoUrl} />
          </div>
          <div className="lg:w-80 flex-shrink-0">
            <Chat />
          </div>
        </div>
      </div>
    </div>
  );
}
