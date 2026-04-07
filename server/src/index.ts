import { Server } from 'socket.io';
import { buildApp } from './app.js';
import { setupSocketHandler } from './socket/handler.js';
import { cleanupExpiredRooms } from './socket/rooms.js';

const PORT = Number(process.env.PORT) || 3001;

async function start() {
  const app = await buildApp();

  const io = new Server(app.server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    },
  });

  setupSocketHandler(io);

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server running on http://localhost:${PORT}`);

  // Cleanup expired rooms every 10 minutes
  setInterval(() => {
    const removed = cleanupExpiredRooms();
    if (removed > 0) console.log(`Cleaned up ${removed} expired room(s)`);
  }, 10 * 60 * 1000);

  return { app, io };
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
