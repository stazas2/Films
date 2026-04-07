import type { Server, Socket } from 'socket.io';
import { createRoom, joinRoom, leaveRoom, getRoomUsers, getRoomBySocket, setBuffering, isRoomReady } from './rooms.js';
import { setupTimeSync } from '../sync/time-sync.js';

export function setupSocketHandler(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);
    setupTimeSync(socket);

    socket.on('room:create', (data: { userName: string }, callback) => {
      const room = createRoom(socket.id, data.userName);
      socket.join(room.code);
      callback({ code: room.code, users: getRoomUsers(room) });
    });

    socket.on('room:join', (data: { code: string; userName: string }, callback) => {
      const result = joinRoom(data.code, socket.id, data.userName);

      if ('error' in result) {
        callback({ error: result.error });
        return;
      }

      const { room } = result;
      socket.join(room.code);

      const users = getRoomUsers(room);
      // Notify others
      socket.to(room.code).emit('room:users', { users });
      // System message
      io.to(room.code).emit('chat:message', {
        id: `sys-${Date.now()}`,
        userId: 'system',
        userName: 'Система',
        text: `${data.userName} присоединился`,
        timestamp: Date.now(),
        isSystem: true,
      });
      // Send current state to joiner
      callback({ code: room.code, users, videoUrl: room.videoUrl });
    });

    socket.on('room:video', (data: { url: string }) => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      room.videoUrl = data.url;
      socket.to(room.code).emit('room:video', { url: data.url });
    });

    // Sync: broadcast play/pause/seek/sync packets to room
    socket.on('sync:packet', (packet: any) => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      socket.to(room.code).emit('sync:packet', packet);
    });

    // When a new user joins, they request state from host
    socket.on('sync:request-state', () => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      // Ask the host for current state
      const hostSocket = io.sockets.sockets.get(room.hostId);
      if (hostSocket) {
        hostSocket.emit('sync:request-state', {}, (state: any) => {
          socket.emit('sync:packet', state);
        });
      }
    });

    // Chat
    socket.on('chat:message', (data: { text: string }) => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      const user = room.users.get(socket.id);
      if (!user) return;

      // Truncate to max length
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

    // Buffering detection
    socket.on('buffer:state', (data: { buffering: boolean }) => {
      const room = setBuffering(socket.id, data.buffering);
      if (!room) return;

      const user = room.users.get(socket.id);
      const userName = user?.name || 'Unknown';

      if (data.buffering) {
        socket.to(room.code).emit('buffer:waiting', { userId: socket.id, userName });
      } else {
        socket.to(room.code).emit('buffer:ready', { userId: socket.id, userName });
        // If everyone is ready, notify room
        if (isRoomReady(room)) {
          io.to(room.code).emit('buffer:all-ready');
        }
      }

      // Update user list with statuses
      io.to(room.code).emit('room:users', { users: getRoomUsers(room) });
    });

    socket.on('disconnect', () => {
      const result = leaveRoom(socket.id);
      if (result) {
        const { room, removed } = result;
        if (room.users.size > 0) {
          io.to(room.code).emit('room:users', { users: getRoomUsers(room) });
          io.to(room.code).emit('room:user-left', { userName: removed.name });
        }
      }
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
