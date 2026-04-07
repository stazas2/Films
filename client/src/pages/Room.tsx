import { useRoomStore } from '../store/room';
import { useRoom } from '../hooks/useRoom';
import Player from '../components/Player';
import LinkInput from '../components/LinkInput';

export default function Room() {
  const { code, users, userName, videoUrl, connected, isHost } = useRoomStore();
  const { sendVideoUrl } = useRoom();

  const copyCode = () => {
    if (code) navigator.clipboard.writeText(code);
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Комната:</h1>
            <button
              onClick={copyCode}
              className="font-mono text-blue-400 hover:text-blue-300 text-xl transition-colors"
              title="Скопировать код"
            >
              {code}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-gray-400">{userName}</span>
          </div>
        </div>

        {/* Участники */}
        <div className="flex gap-2 flex-wrap">
          {users.map((user) => (
            <div
              key={user.id}
              className={`px-3 py-1 rounded-full text-sm ${
                user.isHost ? 'bg-blue-600' : 'bg-gray-700'
              }`}
            >
              {user.name} {user.isHost && '(хост)'}
            </div>
          ))}
        </div>

        {/* Link input (only host) */}
        {isHost && (
          <LinkInput onSubmit={sendVideoUrl} />
        )}

        {/* Player */}
        <Player src={videoUrl} />

        {/* Чат — заглушка */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 h-48 flex items-center justify-center">
          <p className="text-gray-500">Чат будет здесь (Этап 7)</p>
        </div>
      </div>
    </div>
  );
}
