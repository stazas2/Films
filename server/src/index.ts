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
  const cleanupInterval = setInterval(() => {
    const removed = cleanupExpiredRooms();
    if (removed > 0) console.log(`Cleaned up ${removed} expired room(s)`);
  }, 10 * 60 * 1000);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received, notifying clients and closing...`);
    try {
      io.emit('server:restart');
      clearInterval(cleanupInterval);
      // Give clients a brief moment to receive the broadcast before closing sockets.
      await new Promise((r) => setTimeout(r, 500));
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await app.close();
      console.log('[shutdown] closed cleanly');
      process.exit(0);
    } catch (err) {
      console.error('[shutdown] error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return { app, io };
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
