import { describe, it, expect } from 'vitest';
import type { SyncPacket, Room, ChatMessage, UserInfo } from 'shared/types';
import { PROTOCOL_VERSION, MAX_USERS_PER_ROOM, DRIFT_DEAD_ZONE } from 'shared/constants';

describe('Shared types and constants', () => {
  it('SyncPacket type is usable', () => {
    const packet: SyncPacket = {
      type: 'play',
      time: 10.5,
      serverTimestamp: Date.now(),
      userId: 'abc',
    };
    expect(packet.type).toBe('play');
    expect(packet.time).toBe(10.5);
  });

  it('constants are importable and have correct values', () => {
    expect(PROTOCOL_VERSION).toBe(1);
    expect(MAX_USERS_PER_ROOM).toBe(10);
    expect(DRIFT_DEAD_ZONE).toBe(50);
  });

  it('Room type is usable', () => {
    const room: Room = {
      code: 'ABC123',
      users: [],
      videoUrl: null,
      hostId: 'user1',
      createdAt: Date.now(),
    };
    expect(room.code).toBe('ABC123');
  });
});
