import type { Server, Socket } from 'socket.io';
import { createRoom, joinRoom, leaveRoom, getRoomUsers, getRoomBySocket } from './rooms.js';

export function setupSocketHandler(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

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
      // Send current state to joiner
      callback({ code: room.code, users, videoUrl: room.videoUrl });
    });

    socket.on('room:video', (data: { url: string }) => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      room.videoUrl = data.url;
      socket.to(room.code).emit('room:video', { url: data.url });
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
