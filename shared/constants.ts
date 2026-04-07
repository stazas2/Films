// Drift correction thresholds (ms)
export const DRIFT_DEAD_ZONE = 50;
export const DRIFT_SOFT_LIMIT = 500;
export const DRIFT_RATE_FAST = 1.05;
export const DRIFT_RATE_SLOW = 0.95;
export const DRIFT_RECOVERY_ZONE = 30;

// Sync intervals (ms)
export const SYNC_INTERVAL = 2000;
export const TIME_SYNC_INTERVAL = 60000;
export const TIME_SYNC_SAMPLES = 10;
export const TIME_SYNC_TRIM = 2; // discard top/bottom N by RTT

// Room limits
export const MAX_USERS_PER_ROOM = 10;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Chat
export const MAX_MESSAGE_LENGTH = 500;

// Rate limiting
export const MAX_EVENTS_PER_SEC = 20;
export const PROXY_RATE_LIMIT = 100; // per minute per IP

// Buffering
export const BUFFER_TIMEOUT_MS = 30000;

// Protocol version
export const PROTOCOL_VERSION = 1;
