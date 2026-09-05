import { describe, it, expect } from 'vitest';
import { PREMIUM_BOARD, createEmptyBoard, LETTER_POINTS, LETTER_COUNTS } from '../src/game/board';

describe('PREMIUM_BOARD', () => {
  it('is 15x15', () => {
    expect(PREMIUM_BOARD).toHaveLength(15);
    PREMIUM_BOARD.forEach(row => expect(row).toHaveLength(15));
  });

  it('has STAR at center (7,7)', () => {
    expect(PREMIUM_BOARD[7][7]).toBe('STAR');
  });

  it('has TW at all four corners', () => {
    expect(PREMIUM_BOARD[0][0]).toBe('TW');
    expect(PREMIUM_BOARD[0][14]).toBe('TW');
    expect(PREMIUM_BOARD[14][0]).toBe('TW');
    expect(PREMIUM_BOARD[14][14]).toBe('TW');
  });

  it('has TW at row/column midpoints on edges', () => {
    expect(PREMIUM_BOARD[0][7]).toBe('TW');
    expect(PREMIUM_BOARD[7][0]).toBe('TW');
    expect(PREMIUM_BOARD[7][14]).toBe('TW');
    expect(PREMIUM_BOARD[14][7]).toBe('TW');
  });
});

describe('createEmptyBoard', () => {
  it('creates a 15x15 board of nulls', () => {
    const b = createEmptyBoard();
    expect(b).toHaveLength(15);
    b.forEach(row => {
      expect(row).toHaveLength(15);
      row.forEach(cell => expect(cell).toBeNull());
    });
  });
});

describe('LETTER_POINTS', () => {
  it('assigns 1 point to A, E, I, L, N, O, R, S, T, U', () => {
    ['A', 'E', 'I', 'L', 'N', 'O', 'R', 'S', 'T', 'U'].forEach(l =>
      expect(LETTER_POINTS[l as keyof typeof LETTER_POINTS]).toBe(1),
    );
  });
  it('assigns 10 points to Q and Z', () => {
    expect(LETTER_POINTS.Q).toBe(10);
    expect(LETTER_POINTS.Z).toBe(10);
  });
});

describe('LETTER_COUNTS', () => {
  it('totals 100 tiles including 2 blanks', () => {
    const total = Object.values(LETTER_COUNTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
  it('assigns 12 Es and 9 As and 2 blanks', () => {
    expect(LETTER_COUNTS.E).toBe(12);
    expect(LETTER_COUNTS.A).toBe(9);
    expect(LETTER_COUNTS.BLANK).toBe(2);
  });
});
