// === Sync Protocol ===

export type SyncType = 'play' | 'pause' | 'seek' | 'sync';
export type BufferState = 'buffering' | 'ready';

export interface SyncPacket {
  type: SyncType;
  time: number;           // video.currentTime
  serverTimestamp: number; // TimeSync.getServerTime()
  userId: string;
  userName?: string;       // injected by server on broadcast
}

export interface BufferPacket {
  type: BufferState;
  userId: string;
}

// === Room ===

export interface UserInfo {
  id: string;
  name: string;
  isHost: boolean;
  status: 'watching' | 'buffering' | 'disconnected';
}

export interface Room {
  code: string;
  users: UserInfo[];
  videoUrl: string | null;
  hostId: string;
  createdAt: number;
}

export interface RoomEvent {
  type: 'room:create' | 'room:join' | 'room:leave' | 'room:users' | 'room:error' | 'room:video';
  payload: unknown;
}

// === Chat ===

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
}

// === Time Sync ===

export interface TimePong {
  serverTime: number;
}
