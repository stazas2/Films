import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { setupTimeSync } from '../src/sync/time-sync.js';

describe('Time Sync (server)', () => {
  let io: Server;
  let httpServer: ReturnType<typeof createServer>;
  let client: ClientSocket;
  let port: number;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        httpServer = createServer();
        io = new Server(httpServer);
        io.on('connection', (socket) => setupTimeSync(socket));
        httpServer.listen(0, () => {
          const addr = httpServer.address();
          port = typeof addr === 'object' && addr ? addr.port : 0;
          resolve();
        });
      }),
  );

  afterAll(
    () =>
      new Promise<void>((resolve) => {
        client?.disconnect();
        io.close();
        httpServer.close(() => resolve());
      }),
  );

  it('time:ping returns serverTime close to Date.now()', async () => {
    client = ioClient(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
    await new Promise<void>((r) => client.on('connect', r));

    const before = Date.now();
    const result = await new Promise<any>((resolve) => {
      client.emit('time:ping', { clientTime: before }, resolve);
    });
    const after = Date.now();

    expect(result.serverTime).toBeGreaterThanOrEqual(before);
    expect(result.serverTime).toBeLessThanOrEqual(after);
    expect(result.clientTime).toBe(before);
  });
});
