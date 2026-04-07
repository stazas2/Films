import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { setupSocketHandler } from '../src/socket/handler.js';
import { _clearRooms } from '../src/socket/rooms.js';

describe('Socket.io integration', () => {
  let io: Server;
  let httpServer: ReturnType<typeof createServer>;
  let clientA: ClientSocket;
  let clientB: ClientSocket;
  let port: number;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        _clearRooms();
        httpServer = createServer();
        io = new Server(httpServer);
        setupSocketHandler(io);
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
        clientA?.disconnect();
        clientB?.disconnect();
        io.close();
        httpServer.close(() => resolve());
      }),
  );

  function connect(): ClientSocket {
    return ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    });
  }

  it('create room → join room → both see each other', async () => {
    clientA = connect();
    await new Promise<void>((r) => clientA.on('connect', r));

    // A creates room
    const createResult = await new Promise<any>((resolve) => {
      clientA.emit('room:create', { userName: 'Darius' }, resolve);
    });

    expect(createResult.code).toHaveLength(6);
    expect(createResult.users).toHaveLength(1);
    expect(createResult.users[0].name).toBe('Darius');

    // B joins room
    clientB = connect();
    await new Promise<void>((r) => clientB.on('connect', r));

    // A should receive updated users
    const usersPromise = new Promise<any>((resolve) => {
      clientA.on('room:users', resolve);
    });

    const joinResult = await new Promise<any>((resolve) => {
      clientB.emit('room:join', { code: createResult.code, userName: 'Dasha' }, resolve);
    });

    expect(joinResult.users).toHaveLength(2);

    const usersUpdate = await usersPromise;
    expect(usersUpdate.users).toHaveLength(2);
  });

  it('join non-existent room → error', async () => {
    clientA = connect();
    await new Promise<void>((r) => clientA.on('connect', r));

    const result = await new Promise<any>((resolve) => {
      clientA.emit('room:join', { code: 'ZZZZZZ', userName: 'Test' }, resolve);
    });

    expect(result.error).toBe('Комната не найдена');
  });

  it('disconnect removes user and notifies room', async () => {
    _clearRooms();
    clientA = connect();
    await new Promise<void>((r) => clientA.on('connect', r));

    const { code } = await new Promise<any>((resolve) => {
      clientA.emit('room:create', { userName: 'Darius' }, resolve);
    });

    clientB = connect();
    await new Promise<void>((r) => clientB.on('connect', r));

    await new Promise<any>((resolve) => {
      clientB.emit('room:join', { code, userName: 'Dasha' }, resolve);
    });

    // Listen for user left notification on A
    const leftPromise = new Promise<any>((resolve) => {
      clientA.on('room:user-left', resolve);
    });

    // B disconnects
    clientB.disconnect();

    const leftEvent = await leftPromise;
    expect(leftEvent.userName).toBe('Dasha');
  });
});
