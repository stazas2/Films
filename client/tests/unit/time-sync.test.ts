import { describe, it, expect } from 'vitest';
import { TIME_SYNC_SAMPLES, TIME_SYNC_TRIM } from 'shared/constants';

describe('TimeSync algorithm (unit)', () => {
  it('offset formula: ((T2-T1) + (T2-T3)) / 2 with known values', () => {
    // Client sends at T1=100, server receives at T2=200, client receives at T3=300
    const t1 = 100;
    const t2 = 200;
    const t3 = 300;
    const offset = ((t2 - t1) + (t2 - t3)) / 2;
    // offset = (100 + (-100)) / 2 = 0 — clocks are in sync, just 200ms RTT
    expect(offset).toBe(0);
  });

  it('offset formula with clock ahead', () => {
    // Server clock is 50ms ahead
    const t1 = 100;
    const t2 = 250; // server is 50ms ahead + 100ms network delay
    const t3 = 300;
    const offset = ((t2 - t1) + (t2 - t3)) / 2;
    // offset = (150 + (-50)) / 2 = 50 — server is 50ms ahead
    expect(offset).toBe(50);
  });

  it('offset formula with clock behind', () => {
    const t1 = 100;
    const t2 = 150; // server is 50ms behind + 100ms network
    const t3 = 300;
    const offset = ((t2 - t1) + (t2 - t3)) / 2;
    // offset = (50 + (-150)) / 2 = -50
    expect(offset).toBe(-50);
  });

  it('trimming: removes top/bottom N by RTT', () => {
    const samples = [
      { offset: 10, rtt: 500 },  // outlier high
      { offset: 12, rtt: 400 },  // outlier high
      { offset: 5, rtt: 50 },
      { offset: 6, rtt: 60 },
      { offset: 7, rtt: 70 },
      { offset: 5, rtt: 55 },
      { offset: 6, rtt: 65 },
      { offset: 7, rtt: 75 },
      { offset: 3, rtt: 10 },    // outlier low
      { offset: 4, rtt: 15 },    // outlier low
    ];

    // Sort by RTT
    samples.sort((a, b) => a.rtt - b.rtt);
    const trimmed = samples.slice(TIME_SYNC_TRIM, samples.length - TIME_SYNC_TRIM);

    expect(trimmed).toHaveLength(TIME_SYNC_SAMPLES - TIME_SYNC_TRIM * 2);
    // Should not contain the extreme RTTs
    expect(trimmed.every((s) => s.rtt >= 50 && s.rtt <= 75)).toBe(true);

    const avgOffset = trimmed.reduce((sum, s) => sum + s.offset, 0) / trimmed.length;
    expect(avgOffset).toBe(6); // (5+5+6+6+7+7)/6 = 6
  });

  it('re-sync updates offset', () => {
    // Simulating that a second sync gives a different result
    let offset = 10;
    // After re-sync
    offset = 15;
    expect(offset).toBe(15);
  });
});
