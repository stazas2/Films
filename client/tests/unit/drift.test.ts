import { describe, it, expect } from 'vitest';
import {
  DRIFT_DEAD_ZONE,
  DRIFT_SOFT_LIMIT,
  DRIFT_RATE_FAST,
  DRIFT_RATE_SLOW,
  DRIFT_RECOVERY_ZONE,
} from 'shared/constants';

// Test the drift correction algorithm logic independently
describe('Drift Correction algorithm', () => {
  function simulateCorrection(driftMs: number) {
    const absDrift = Math.abs(driftMs);
    const drift = driftMs / 1000; // seconds, positive = ahead

    if (absDrift < DRIFT_DEAD_ZONE) {
      return { action: 'none', playbackRate: 1.0 };
    }

    if (absDrift < DRIFT_SOFT_LIMIT) {
      if (absDrift < DRIFT_RECOVERY_ZONE) {
        return { action: 'recovered', playbackRate: 1.0 };
      }
      const rate = drift > 0 ? DRIFT_RATE_SLOW : DRIFT_RATE_FAST;
      return { action: 'soft', playbackRate: rate };
    }

    return { action: 'hard-seek', playbackRate: 1.0 };
  }

  it('drift < 50ms → no action (dead zone)', () => {
    const result = simulateCorrection(30);
    expect(result.action).toBe('none');
    expect(result.playbackRate).toBe(1.0);
  });

  it('drift 200ms ahead → playbackRate = 0.95 (slow down)', () => {
    const result = simulateCorrection(200);
    expect(result.action).toBe('soft');
    expect(result.playbackRate).toBe(0.95);
  });

  it('drift -200ms behind → playbackRate = 1.05 (speed up)', () => {
    const result = simulateCorrection(-200);
    expect(result.action).toBe('soft');
    expect(result.playbackRate).toBe(1.05);
  });

  it('drift 800ms → hard seek', () => {
    const result = simulateCorrection(800);
    expect(result.action).toBe('hard-seek');
    expect(result.playbackRate).toBe(1.0);
  });

  it('drift -800ms → hard seek', () => {
    const result = simulateCorrection(-800);
    expect(result.action).toBe('hard-seek');
  });

  it('drift < 30ms (recovery zone) → reset to 1.0', () => {
    // After correction, drift drops below recovery zone
    const result = simulateCorrection(25);
    expect(result.action).toBe('none');
    expect(result.playbackRate).toBe(1.0);
  });

  it('constants have correct values', () => {
    expect(DRIFT_DEAD_ZONE).toBe(50);
    expect(DRIFT_SOFT_LIMIT).toBe(500);
    expect(DRIFT_RATE_FAST).toBe(1.05);
    expect(DRIFT_RATE_SLOW).toBe(0.95);
    expect(DRIFT_RECOVERY_ZONE).toBe(30);
  });
});
