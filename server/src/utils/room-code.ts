import { ROOM_CODE_LENGTH } from 'shared/constants';

// Excluded: O/0 (confusion), I/1 (confusion), L (looks like 1)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
