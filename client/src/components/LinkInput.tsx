import { useState } from 'react';

interface Props {
  onSubmit: (url: string) => void;
  disabled?: boolean;
}

export default function LinkInput({ onSubmit, disabled }: Props) {
  const [url, setUrl] = useState('');

  const isValid = (value: string) => {
    try {
      const parsed = new URL(value);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed || !isValid(trimmed)) return;
    onSubmit(trimmed);
    setUrl('');
  };

  return (
    <div className="glass rounded-2xl p-3 flex gap-2 items-center shadow-card">
      <svg className="w-5 h-5 text-ink-300 ml-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      <input
        type="url"
        placeholder="Вставь .m3u8 ссылку — и погнали"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        disabled={disabled}
        className="flex-1 px-2 py-2 bg-transparent text-ink-50 placeholder-ink-300/60 focus:outline-none text-sm"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !isValid(url.trim())}
        className="px-5 py-2 rounded-xl text-ink-950 font-medium bg-amber-400 hover:bg-amber-300 disabled:bg-white/5 disabled:text-ink-400 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-1.5"
      >
        Запустить
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    </div>
  );
}
