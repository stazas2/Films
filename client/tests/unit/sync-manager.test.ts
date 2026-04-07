import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the sync logic independently (without real socket)
describe('SyncManager logic', () => {
  it('isRemoteAction flag prevents echo', () => {
    let isRemoteAction = false;
    const sentPackets: string[] = [];

    function onLocalPlay() {
      if (isRemoteAction) return;
      sentPackets.push('play');
    }

    function onRemotePlay() {
      isRemoteAction = true;
      // simulate applying remote action
      onLocalPlay(); // should NOT add to sentPackets
      isRemoteAction = false;
    }

    // Local play → sends packet
    onLocalPlay();
    expect(sentPackets).toEqual(['play']);

    // Remote play → does NOT send packet back
    onRemotePlay();
    expect(sentPackets).toEqual(['play']); // still just 1
  });

  it('SyncPacket has correct shape', () => {
    const packet = {
      type: 'play' as const,
      time: 42.5,
      serverTimestamp: Date.now(),
      userId: 'abc123',
    };

    expect(packet.type).toBe('play');
    expect(typeof packet.time).toBe('number');
    expect(typeof packet.serverTimestamp).toBe('number');
    expect(typeof packet.userId).toBe('string');
  });

  it('seek packet sets correct time', () => {
    let videoCurrentTime = 0;

    function applySeek(packet: { type: string; time: number }) {
      if (packet.type === 'seek') {
        videoCurrentTime = packet.time;
      }
    }

    applySeek({ type: 'seek', time: 123.456 });
    expect(videoCurrentTime).toBe(123.456);
  });

  it('host conflict: host packet wins', () => {
    const hostId = 'host1';
    let currentTime = 50;

    function applyPacket(packet: { userId: string; time: number }, isHost: boolean) {
      // In conflict, host always wins
      if (isHost || packet.userId === hostId) {
        currentTime = packet.time;
      }
    }

    // Non-host tries to set time
    applyPacket({ userId: 'user2', time: 100 }, false);
    expect(currentTime).toBe(50); // unchanged

    // Host sets time
    applyPacket({ userId: hostId, time: 200 }, true);
    expect(currentTime).toBe(200);
  });
});
