import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useRoomStore } from '../store/room';
import type { UserInfo } from 'shared/types';

export function useRoom() {
  const navigate = useNavigate();
  const store = useRoomStore();

  useEffect(() => {
    const tryRejoin = () => {
      const { code, userName } = useRoomStore.getState();
      if (!code || !userName) return;
      socket.emit(
        'room:join',
        { code, userName },
        (res: { code?: string; users?: UserInfo[]; videoUrl?: string | null; error?: string }) => {
          if (res.error) {
            const msg = res.error || 'Комната больше не доступна';
            useRoomStore.getState().setRejoinError(msg);
            useRoomStore.getState().reset();
            navigate('/');
            return;
          }
          if (res.users) {
            useRoomStore.getState().setUsers(res.users);
            useRoomStore.getState().setVideoUrl(res.videoUrl ?? null);
          }
        },
      );
    };

    const onConnect = () => {
      console.log(`[socket] connected id=${socket.id}`);
      store.setConnected(true);
      tryRejoin();
    };

    socket.on('connect', onConnect);

    if (socket.connected) {
      // Already connected (HMR / remount) — fire handler manually
      onConnect();
    } else {
      socket.connect();
    }

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected reason=${reason}`);
      store.setConnected(false);
    });

    socket.on('server:restart', () => {
      console.log('[socket] server restart announced — reconnect expected');
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[socket] reconnecting attempt=${attempt}`);
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
      socket.off('connect', onConnect);
      socket.off('disconnect');
      socket.off('room:users');
      socket.off('room:video');
      socket.off('room:user-left');
      socket.off('server:restart');
      socket.io.off('reconnect_attempt');
    };
  }, []);

  const createRoom = useCallback(
    (userName: string) => {
      store.setUserName(userName);
      socket.emit(
        'room:create',
        { userName },
        (res: { code: string; users: UserInfo[] }) => {
          store.setRoom(res.code, res.users, true);
          // If we arrived with ?video=... from the bookmarklet, push it to the room now.
          const pending = useRoomStore.getState().pendingVideoUrl;
          if (pending) {
            useRoomStore.getState().setVideoUrl(pending);
            socket.emit('room:video', { url: pending });
            useRoomStore.getState().setPendingVideoUrl(null);
          }
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
