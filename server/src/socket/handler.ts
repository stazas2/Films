import type { Server, Socket } from 'socket.io';
import { createRoom, joinRoom, leaveRoom, getRoomUsers, getRoomBySocket, setBuffering, isRoomReady } from './rooms.js';
import { setupTimeSync } from '../sync/time-sync.js';
import { MAX_EVENTS_PER_SEC } from 'shared/constants';

// Simple rate limiter per socket
function createRateLimiter() {
  const counts = new Map<string, { count: number; resetAt: number; warned: boolean }>();

  return (socketId: string, event: string): boolean => {
    const now = Date.now();
    let entry = counts.get(socketId);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + 1000, warned: false };
      counts.set(socketId, entry);
    }

    entry.count++;
    const allowed = entry.count <= MAX_EVENTS_PER_SEC;
    if (!allowed && !entry.warned) {
      console.warn(`[ratelimit] socket=${socketId} blocked event=${event}`);
      entry.warned = true;
    }
    return allowed;
  };
}

export function setupSocketHandler(io: Server) {
  const checkRate = createRateLimiter();

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);
    setupTimeSync(socket);

    socket.on('room:create', (data: { userName: string }, callback) => {
      if (!checkRate(socket.id, 'room:create')) return;
      const room = createRoom(socket.id, data.userName);
      socket.join(room.code);
      console.log(`[room] create code=${room.code} host=${data.userName} socket=${socket.id}`);
      callback({ code: room.code, users: getRoomUsers(room) });
    });

    socket.on('room:join', (data: { code: string; userName: string }, callback) => {
      if (!checkRate(socket.id, 'room:join')) return;
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
      console.log(`[room] join code=${room.code} user=${data.userName} socket=${socket.id} size=${users.length}`);
      callback({ code: room.code, users, videoUrl: room.videoUrl });
    });

    socket.on('room:video', (data: { url: string }) => {
      if (!checkRate(socket.id, 'room:video')) return;
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      room.videoUrl = data.url;
      socket.to(room.code).emit('room:video', { url: data.url });
    });

    socket.on('sync:packet', (packet: any) => {
      if (!checkRate(socket.id, 'sync:packet')) return;
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      const user = room.users.get(socket.id);
      const enriched = { ...packet, userName: user?.name };
      socket.to(room.code).emit('sync:packet', enriched);
    });

    socket.on('sync:request-state', () => {
      if (!checkRate(socket.id, 'sync:request-state')) return;
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
      if (!checkRate(socket.id, 'chat:message')) return;
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
      if (!checkRate(socket.id, 'buffer:state')) return;
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
        const { room, removed, newHost } = result;
        console.log(`[room] leave code=${room.code} user=${removed.name} socket=${socket.id} size=${room.users.size}`);
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
          if (newHost) {
            console.log(`[room] host migrated code=${room.code} from=${removed.name} to=${newHost.name}`);
            io.to(room.code).emit('chat:message', {
              id: `sys-${Date.now() + 1}`,
              userId: 'system',
              userName: 'Система',
              text: `${newHost.name} теперь хост`,
              timestamp: Date.now(),
              isSystem: true,
            });
          }
        }
      }
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
