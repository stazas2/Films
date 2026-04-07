import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useRoomStore } from '../store/room';
import type { UserInfo } from 'shared/types';

export function useRoom() {
  const navigate = useNavigate();
  const store = useRoomStore();

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    socket.on('connect', () => {
      store.setConnected(true);

      // Auto-rejoin room after reconnect
      const { code, userName } = useRoomStore.getState();
      if (code && userName) {
        socket.emit(
          'room:join',
          { code, userName },
          (res: { code?: string; users?: UserInfo[]; videoUrl?: string | null; error?: string }) => {
            if (!res.error && res.users) {
              store.setUsers(res.users);
              if (res.videoUrl) store.setVideoUrl(res.videoUrl);
            }
          },
        );
      }
    });

    socket.on('disconnect', () => {
      store.setConnected(false);
    });

    socket.on('room:users', (data: { users: UserInfo[] }) => {
      store.setUsers(data.users);
    });

    socket.on('room:video', (data: { url: string }) => {
      store.setVideoUrl(data.url);
    });

    socket.on('room:user-left', (data: { userName: string }) => {
      // Handled via room:users update + chat system message
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:users');
      socket.off('room:video');
      socket.off('room:user-left');
    };
  }, []);

  const createRoom = useCallback(
    (userName: string) => {
      store.setUserName(userName);
      socket.emit(
        'room:create',
        { userName },
        (res: { code: string; users: UserInfo[] }) => {
          store.setRoom(res.code, res.users);
          navigate(`/room/${res.code}`);
        },
      );
    },
    [navigate],
  );

  const joinRoom = useCallback(
    (code: string, userName: string) => {
      store.setUserName(userName);
      socket.emit(
        'room:join',
        { code, userName },
        (res: { code?: string; users?: UserInfo[]; videoUrl?: string | null; error?: string }) => {
          if (res.error) {
            alert(res.error);
            return;
          }
          store.setRoom(res.code!, res.users!);
          if (res.videoUrl) store.setVideoUrl(res.videoUrl);
          navigate(`/room/${res.code}`);
        },
      );
    },
    [navigate],
  );

  const sendVideoUrl = useCallback((url: string) => {
    store.setVideoUrl(url);
    socket.emit('room:video', { url });
  }, []);

  return { createRoom, joinRoom, sendVideoUrl, ...store };
}
