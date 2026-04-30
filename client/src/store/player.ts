import { create } from 'zustand';

export interface QualityLevel {
  height: number;
  bitrate: number;
}

interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  buffering: boolean;
  error: string | null;
  levels: QualityLevel[];
  /** -1 means auto (HLS adaptive). Otherwise an index into `levels`. */
  currentLevel: number;
  /** Index of the level HLS is actually playing right now (for "auto → 720p" hint). */
  playingLevel: number;

  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setBuffering: (buffering: boolean) => void;
  setError: (error: string | null) => void;
  setLevels: (levels: QualityLevel[]) => void;
  setCurrentLevel: (level: number) => void;
  setPlayingLevel: (level: number) => void;
  resetQuality: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  buffering: false,
  error: null,
  levels: [],
  currentLevel: -1,
  playingLevel: -1,

  setPlaying: (playing) => set({ playing }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setMuted: (muted) => set({ muted }),
  setBuffering: (buffering) => set({ buffering }),
  setError: (error) => set({ error }),
  setLevels: (levels) => set({ levels }),
  setCurrentLevel: (currentLevel) => set({ currentLevel }),
  setPlayingLevel: (playingLevel) => set({ playingLevel }),
  resetQuality: () => set({ levels: [], currentLevel: -1, playingLevel: -1 }),
}));
