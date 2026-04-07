import { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { MAX_MESSAGE_LENGTH } from 'shared/constants';
import type { ChatMessage } from 'shared/types';

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    socket.emit('chat:message', { text: text.slice(0, MAX_MESSAGE_LENGTH) });
    setInput('');
  };

  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col h-64 lg:h-80">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-gray-600 text-sm text-center mt-8">Сообщений пока нет</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={msg.isSystem ? 'text-center' : ''}>
            {msg.isSystem ? (
              <span className="text-gray-500 text-xs italic">{escapeHtml(msg.text)}</span>
            ) : (
              <div>
                <span className="text-blue-400 text-sm font-medium">{escapeHtml(msg.userName)}: </span>
                <span className="text-gray-300 text-sm">{escapeHtml(msg.text)}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Написать сообщение..."
          className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 border border-gray-700"
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
        >
          Отправить
        </button>
      </div>
    </div>
  );
}
