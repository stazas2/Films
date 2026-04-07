import { create } from 'zustand';

interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  buffering: boolean;
  error: string | null;

  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setBuffering: (buffering: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  buffering: false,
  error: null,

  setPlaying: (playing) => set({ playing }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setMuted: (muted) => set({ muted }),
  setBuffering: (buffering) => set({ buffering }),
  setError: (error) => set({ error }),
}));
