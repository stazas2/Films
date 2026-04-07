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
    <div className="flex gap-2">
      <input
        type="url"
        placeholder="Вставьте .m3u8 ссылку на видео"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        disabled={disabled}
        className="flex-1 px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 text-sm"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !isValid(url.trim())}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
      >
        Загрузить
      </button>
    </div>
  );
}
