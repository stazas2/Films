import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  getRoomUsers,
  getRoomsCount,
  _clearRooms,
} from '../src/socket/rooms.js';

describe('Room management', () => {
  beforeEach(() => {
    _clearRooms();
  });

  it('createRoom creates a room with the creator as host', () => {
    const room = createRoom('socket1', 'Darius');
    expect(room.code).toHaveLength(6);
    expect(room.hostId).toBe('socket1');
    expect(getRoomUsers(room)).toEqual([
      { id: 'socket1', name: 'Darius', isHost: true, status: 'watching' },
    ]);
  });

  it('joinRoom adds a user to existing room', () => {
    const room = createRoom('socket1', 'Darius');
    const result = joinRoom(room.code, 'socket2', 'Dasha');
    expect('room' in result).toBe(true);
    if ('room' in result) {
      expect(getRoomUsers(result.room)).toHaveLength(2);
      expect(getRoomUsers(result.room)[1].name).toBe('Dasha');
      expect(getRoomUsers(result.room)[1].isHost).toBe(false);
    }
  });

  it('joinRoom returns error for non-existent room', () => {
    const result = joinRoom('ZZZZZZ', 'socket1', 'User');
    expect('error' in result).toBe(true);
  });

  it('joinRoom returns error when room is full (10 users)', () => {
    const room = createRoom('socket0', 'Host');
    for (let i = 1; i < 10; i++) {
      joinRoom(room.code, `socket${i}`, `User${i}`);
    }
    const result = joinRoom(room.code, 'socket10', 'User10');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('Комната заполнена');
    }
  });

  it('leaveRoom removes user from room', () => {
    const room = createRoom('socket1', 'Darius');
    joinRoom(room.code, 'socket2', 'Dasha');

    const result = leaveRoom('socket2');
    expect(result).not.toBeNull();
    expect(result!.removed.name).toBe('Dasha');
    expect(getRoomUsers(room)).toHaveLength(1);
  });

  it('leaveRoom deletes room when last user leaves', () => {
    const room = createRoom('socket1', 'Darius');
    expect(getRoomsCount()).toBe(1);

    leaveRoom('socket1');
    expect(getRoomsCount()).toBe(0);
    expect(getRoom(room.code)).toBeUndefined();
  });

  it('leaveRoom migrates host when host leaves', () => {
    const room = createRoom('socket1', 'Darius');
    joinRoom(room.code, 'socket2', 'Dasha');

    leaveRoom('socket1');

    expect(room.hostId).toBe('socket2');
    const users = getRoomUsers(room);
    expect(users[0].isHost).toBe(true);
  });

  it('leaveRoom returns null for unknown socket', () => {
    expect(leaveRoom('unknown')).toBeNull();
  });
});
