import type { Server, Socket } from 'socket.io';
import { createRoom, joinRoom, leaveRoom, getRoomUsers, getRoomBySocket, setBuffering, isRoomReady } from './rooms.js';
import { setupTimeSync } from '../sync/time-sync.js';
import { MAX_EVENTS_PER_SEC } from 'shared/constants';

// Simple rate limiter per socket
function createRateLimiter() {
  const counts = new Map<string, { count: number; resetAt: number }>();

  return (socketId: string): boolean => {
    const now = Date.now();
    let entry = counts.get(socketId);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + 1000 };
      counts.set(socketId, entry);
    }

    entry.count++;
    return entry.count <= MAX_EVENTS_PER_SEC;
  };
}

export function setupSocketHandler(io: Server) {
  const checkRate = createRateLimiter();

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);
    setupTimeSync(socket);

    socket.on('room:create', (data: { userName: string }, callback) => {
      if (!checkRate(socket.id)) return;
      const room = createRoom(socket.id, data.userName);
      socket.join(room.code);
      callback({ code: room.code, users: getRoomUsers(room) });
    });

    socket.on('room:join', (data: { code: string; userName: string }, callback) => {
      if (!checkRate(socket.id)) return;
      const result = joinRoom(data.code, socket.id, data.userName);

      if ('error' in result) {
        callback({ error: result.error });
        return;
      }

      const { room } = result;
      socket.join(room.code);

      const users = getRoomUsers(room);
      socket.to(room.code).emit('room:users', { users });
      io.to(room.code).emit('chat:message', {
        id: `sys-${Date.now()}`,
        userId: 'system',
        userName: 'Система',
        text: `${data.userName} присоединился`,
        timestamp: Date.now(),
        isSystem: true,
      });
      callback({ code: room.code, users, videoUrl: room.videoUrl });
    });

    socket.on('room:video', (data: { url: string }) => {
      if (!checkRate(socket.id)) return;
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      room.videoUrl = data.url;
      socket.to(room.code).emit('room:video', { url: data.url });
    });

    socket.on('sync:packet', (packet: any) => {
      if (!checkRate(socket.id)) return;
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      socket.to(room.code).emit('sync:packet', packet);
    });

    socket.on('sync:request-state', () => {
      if (!checkRate(socket.id)) return;
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      const hostSocket = io.sockets.sockets.get(room.hostId);
      if (hostSocket) {
        hostSocket.emit('sync:request-state', {}, (state: any) => {
          socket.emit('sync:packet', state);
        });
      }
    });

    socket.on('chat:message', (data: { text: string }) => {
      if (!checkRate(socket.id)) return;
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      const user = room.users.get(socket.id);
      if (!user) return;

      const text = data.text.slice(0, 500);

      const message = {
        id: `${socket.id}-${Date.now()}`,
        userId: socket.id,
        userName: user.name,
        text,
        timestamp: Date.now(),
        isSystem: false,
      };

      io.to(room.code).emit('chat:message', message);
    });

    socket.on('buffer:state', (data: { buffering: boolean }) => {
      if (!checkRate(socket.id)) return;
      const room = setBuffering(socket.id, data.buffering);
      if (!room) return;

      const user = room.users.get(socket.id);
      const userName = user?.name || 'Unknown';

      if (data.buffering) {
        socket.to(room.code).emit('buffer:waiting', { userId: socket.id, userName });
      } else {
        socket.to(room.code).emit('buffer:ready', { userId: socket.id, userName });
        if (isRoomReady(room)) {
          io.to(room.code).emit('buffer:all-ready');
        }
      }

      io.to(room.code).emit('room:users', { users: getRoomUsers(room) });
    });

    socket.on('disconnect', () => {
      const result = leaveRoom(socket.id);
      if (result) {
        const { room, removed } = result;
        if (room.users.size > 0) {
          io.to(room.code).emit('room:users', { users: getRoomUsers(room) });
          io.to(room.code).emit('room:user-left', { userName: removed.name });
          // System chat message
          io.to(room.code).emit('chat:message', {
            id: `sys-${Date.now()}`,
            userId: 'system',
            userName: 'Система',
            text: `${removed.name} отключился`,
            timestamp: Date.now(),
            isSystem: true,
          });
        }
      }
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
