import type { Server, Socket } from 'socket.io';

export function setupTimeSync(socket: Socket) {
  socket.on('time:ping', (data: { clientTime: number }, callback) => {
    callback({ serverTime: Date.now(), clientTime: data.clientTime });
  });
}
