import { create } from 'zustand';
import type { UserInfo } from 'shared/types';

interface RoomState {
  code: string | null;
  users: UserInfo[];
  userName: string;
  isHost: boolean;
  videoUrl: string | null;
  connected: boolean;

  setRoom: (code: string, users: UserInfo[]) => void;
  setUsers: (users: UserInfo[]) => void;
  setUserName: (name: string) => void;
  setVideoUrl: (url: string) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  code: null,
  users: [],
  userName: '',
  isHost: false,
  videoUrl: null,
  connected: false,

  setRoom: (code, users) => {
    const me = users.find((u) => u.isHost) || users[0];
    set({ code, users, isHost: me?.isHost ?? false });
  },

  setUsers: (users) => {
    const myName = get().userName;
    const me = users.find((u) => u.name === myName);
    set({ users, isHost: me?.isHost ?? false });
  },

  setUserName: (name) => set({ userName: name }),

  setVideoUrl: (url) => set({ videoUrl: url }),

  setConnected: (connected) => set({ connected }),

  reset: () =>
    set({
      code: null,
      users: [],
      isHost: false,
      videoUrl: null,
      connected: false,
    }),
}));
