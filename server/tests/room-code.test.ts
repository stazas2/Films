import { describe, it, expect } from 'vitest';
import { generateRoomCode } from '../src/utils/room-code.js';

describe('generateRoomCode', () => {
  it('generates a 6-character code', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it('contains only allowed characters (no O/0/I/1/L)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('generates unique codes (1000 iterations)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      codes.add(generateRoomCode());
    }
    // With 30^6 ≈ 729M possible codes, 1000 should be unique
    expect(codes.size).toBe(1000);
  });
});
