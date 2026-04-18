import { MAX_USERS_PER_ROOM, ROOM_TTL_MS, EMPTY_ROOM_GRACE_MS } from 'shared/constants';
import type { UserInfo } from 'shared/types';
import { generateRoomCode } from '../utils/room-code.js';

export interface ServerRoom {
  code: string;
  users: Map<string, UserInfo>;
  hostId: string;
  creatorName: string;
  videoUrl: string | null;
  createdAt: number;
  bufferingUsers: Set<string>;
  /** Timer that deletes the room after grace period when it becomes empty. Cleared on next join. */
  emptyDeleteTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, ServerRoom>();

export function createRoom(socketId: string, userName: string): ServerRoom {
  let code: string;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));

  const user: UserInfo = {
    id: socketId,
    name: userName,
    isHost: true,
    status: 'watching',
  };

  const room: ServerRoom = {
    code,
    users: new Map([[socketId, user]]),
    hostId: socketId,
    creatorName: userName,
    videoUrl: null,
    createdAt: Date.now(),
    bufferingUsers: new Set(),
    emptyDeleteTimer: null,
  };

  rooms.set(code, room);
  return room;
}

export function joinRoom(
  code: string,
  socketId: string,
  userName: string,
): { room: ServerRoom } | { error: string } {
  const room = rooms.get(code);
  if (!room) return { error: 'Комната не найдена' };
  if (room.users.size >= MAX_USERS_PER_ROOM) return { error: 'Комната заполнена' };

  // Someone rejoined — cancel pending delete if any
  if (room.emptyDeleteTimer) {
    clearTimeout(room.emptyDeleteTimer);
    room.emptyDeleteTimer = null;
  }

  // Creator reclaims host on rejoin (by name match)
  const isCreator = userName === room.creatorName;

  const user: UserInfo = {
    id: socketId,
    name: userName,
    isHost: isCreator,
    status: 'watching',
  };

  if (isCreator) {
    // Demote whoever was acting as host
    const prevHost = room.users.get(room.hostId);
    if (prevHost && prevHost.id !== socketId) {
      prevHost.isHost = false;
    }
    room.hostId = socketId;
  }

  room.users.set(socketId, user);
  return { room };
}

export function leaveRoom(
  socketId: string,
): { room: ServerRoom; removed: UserInfo; newHost?: UserInfo } | null {
  for (const [code, room] of rooms) {
    const user = room.users.get(socketId);
    if (!user) continue;

    room.users.delete(socketId);
    room.bufferingUsers.delete(socketId);

    // Room empty → schedule delete after grace period so a solo host can refresh
    if (room.users.size === 0) {
      if (room.emptyDeleteTimer) clearTimeout(room.emptyDeleteTimer);
      room.emptyDeleteTimer = setTimeout(() => {
        const current = rooms.get(code);
        if (current && current.users.size === 0) rooms.delete(code);
      }, EMPTY_ROOM_GRACE_MS);
      return { room, removed: user };
    }

    // Host left → migrate to next user (creator can later reclaim on rejoin)
    if (room.hostId === socketId) {
      const newHost = room.users.values().next().value!;
      newHost.isHost = true;
      room.hostId = newHost.id;
      return { room, removed: user, newHost };
    }

    return { room, removed: user };
  }
  return null;
}

export function getRoom(code: string): ServerRoom | undefined {
  return rooms.get(code);
}

export function getRoomBySocket(socketId: string): ServerRoom | undefined {
  for (const room of rooms.values()) {
    if (room.users.has(socketId)) return room;
  }
  return undefined;
}

export function getRoomUsers(room: ServerRoom): UserInfo[] {
  return Array.from(room.users.values());
}

export function getRoomsCount(): number {
  return rooms.size;
}

export function setBuffering(socketId: string, isBuffering: boolean): ServerRoom | undefined {
  const room = getRoomBySocket(socketId);
  if (!room) return undefined;

  if (isBuffering) {
    room.bufferingUsers.add(socketId);
    const user = room.users.get(socketId);
    if (user) user.status = 'buffering';
  } else {
    room.bufferingUsers.delete(socketId);
    const user = room.users.get(socketId);
    if (user) user.status = 'watching';
  }

  return room;
}

export function isRoomReady(room: ServerRoom): boolean {
  return room.bufferingUsers.size === 0;
}

/** Clean up rooms older than TTL */
export function cleanupExpiredRooms(): number {
  const now = Date.now();
  let removed = 0;
  for (const [code, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      rooms.delete(code);
      removed++;
    }
  }
  return removed;
}

/** For testing only */
export function _clearRooms(): void {
  rooms.clear();
}
