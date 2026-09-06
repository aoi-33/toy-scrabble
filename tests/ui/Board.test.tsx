import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Board } from '../../src/ui/Board';
import { createEmptyBoard } from '../../src/game/board';

describe('<Board>', () => {
  it('renders 225 cells (15x15)', () => {
    render(<Board board={createEmptyBoard()} pending={[]} onCellClick={() => {}} />);
    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(225);
  });

  it('marks the center cell with a star', () => {
    render(<Board board={createEmptyBoard()} pending={[]} onCellClick={() => {}} />);
    expect(screen.getByLabelText('center-star')).toBeInTheDocument();
  });

  it('renders a placed tile', () => {
    const b = createEmptyBoard();
    b[7][7] = { tile: { kind: 'letter', letter: 'A', points: 1 }, placedTurn: 1 };
    render(<Board board={b} pending={[]} onCellClick={() => {}} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('セルのサイズを --cell-size から取る', () => {
    render(<Board board={createEmptyBoard()} pending={[]} onCellClick={() => {}} />);
    const cell = screen.getByLabelText('cell-0-0');
    expect(cell.className).toContain('w-[var(--cell-size)]');
    expect(cell.className).toContain('h-[var(--cell-size)]');
    expect(cell.className).not.toMatch(/\bw-8\b|\bsm:w-9\b/);
  });
});
