import { useState } from 'react';
import { useRoom } from '../hooks/useRoom';

export default function Home() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const { createRoom, joinRoom } = useRoom();

  const handleCreate = () => {
    if (!name.trim()) return;
    createRoom(name.trim());
  };

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim()) return;
    joinRoom(roomCode.trim().toUpperCase(), name.trim());
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold">WatchTogether</h1>
          <p className="mt-2 text-gray-400">Смотри фильмы вместе с друзьями</p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Твоё имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            className="w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500"
          />

          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
          >
            Создать комнату
          </button>

          <div className="flex items-center gap-4">
            <hr className="flex-1 border-gray-700" />
            <span className="text-gray-500 text-sm">или</span>
            <hr className="flex-1 border-gray-700" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Код комнаты"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="flex-1 px-4 py-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 uppercase tracking-widest text-center font-mono"
            />
            <button
              onClick={handleJoin}
              disabled={!name.trim() || !roomCode.trim()}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
            >
              Войти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
