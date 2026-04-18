import { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { MAX_MESSAGE_LENGTH } from 'shared/constants';
import type { ChatMessage } from 'shared/types';

function avatarColor(name: string): string {
  const palette = ['#f5b544', '#8b5cf6', '#22c55e', '#ec4899', '#38bdf8', '#f97316', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    socket.emit('chat:message', { text: text.slice(0, MAX_MESSAGE_LENGTH) });
    setInput('');
  };

  return (
    <div className="glass rounded-2xl flex flex-col h-64 lg:h-[calc(56.25vw*0.56)] lg:max-h-[600px] lg:min-h-[400px] overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <svg className="w-4 h-4 text-ink-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <h3 className="text-sm font-medium text-ink-100">Чат</h3>
        <span className="ml-auto text-xs text-ink-300">{messages.filter((m) => !m.isSystem).length}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-3xl mb-2 opacity-40">💬</div>
            <p className="text-ink-300 text-sm">Сообщений пока нет</p>
            <p className="text-ink-400 text-xs mt-1">Напиши первым</p>
          </div>
        )}
        {messages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="text-center py-1">
                <span className="text-[11px] text-ink-300 italic px-2 py-0.5 rounded-full bg-white/[0.02]">
                  {msg.text}
                </span>
              </div>
            );
          }
          const color = avatarColor(msg.userName);
          return (
            <div key={msg.id} className="flex items-start gap-2.5 group">
              <div
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-ink-950 mt-0.5"
                style={{ backgroundColor: color }}
              >
                {msg.userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-ink-100 truncate">{msg.userName}</span>
                  <span className="text-[10px] text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-ink-100/90 leading-snug break-words">{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/5 p-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Написать сообщение..."
          className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/5 rounded-lg text-sm text-ink-50 placeholder-ink-400 focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.05] transition-colors"
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="px-3 py-2 rounded-lg text-ink-950 font-medium bg-amber-400 hover:bg-amber-300 disabled:bg-white/5 disabled:text-ink-400 disabled:cursor-not-allowed transition-colors"
          aria-label="Отправить"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
