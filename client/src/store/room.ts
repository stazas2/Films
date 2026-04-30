import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserInfo } from 'shared/types';

interface RoomState {
  code: string | null;
  users: UserInfo[];
  userName: string;
  isHost: boolean;
  videoUrl: string | null;
  connected: boolean;
  justCreated: boolean;
  rejoinError: string | null;
  pendingVideoUrl: string | null;

  setRoom: (code: string, users: UserInfo[], justCreated?: boolean) => void;
  setUsers: (users: UserInfo[]) => void;
  setUserName: (name: string) => void;
  setVideoUrl: (url: string | null) => void;
  setConnected: (connected: boolean) => void;
  setRejoinError: (msg: string | null) => void;
  setPendingVideoUrl: (url: string | null) => void;
  clearJustCreated: () => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set, get) => ({
      code: null,
      users: [],
      userName: '',
      isHost: false,
      videoUrl: null,
      connected: false,
      justCreated: false,
      rejoinError: null,
      pendingVideoUrl: null,

      setRoom: (code, users, justCreated = false) => {
        const me = users.find((u) => u.isHost) || users[0];
        set({ code, users, isHost: me?.isHost ?? false, justCreated, rejoinError: null });
      },

      setUsers: (users) => {
        const myName = get().userName;
        const me = users.find((u) => u.name === myName);
        set({ users, isHost: me?.isHost ?? false });
      },

      setUserName: (name) => set({ userName: name }),

      setVideoUrl: (url) => set({ videoUrl: url }),

      setConnected: (connected) => set({ connected }),

      setRejoinError: (msg) => set({ rejoinError: msg }),

      setPendingVideoUrl: (url) => set({ pendingVideoUrl: url }),

      clearJustCreated: () => set({ justCreated: false }),

      reset: () =>
        set({
          code: null,
          users: [],
          isHost: false,
          videoUrl: null,
          connected: false,
          justCreated: false,
        }),
    }),
    {
      name: 'watch-together-room',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        code: state.code,
        userName: state.userName,
        videoUrl: state.videoUrl,
      }),
    },
  ),
);
