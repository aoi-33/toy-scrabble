import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tile } from '../../src/ui/Tile';

describe('<Tile>', () => {
  it('renders letter and points for a letter tile', () => {
    render(<Tile tile={{ kind: 'letter', letter: 'A', points: 1 }} variant="in-rack" />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders assigned letter of a blank tile without points', () => {
    render(<Tile tile={{ kind: 'blank', assigned: 'B', points: 0 }} variant="on-board-confirmed" />);
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders "?" for an unassigned blank tile', () => {
    render(<Tile tile={{ kind: 'blank', assigned: null, points: 0 }} variant="in-rack" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('サイズを --cell-size から取るので固定幅クラスを持たない', () => {
    const { container } = render(<Tile tile={{ kind: 'letter', letter: 'A', points: 1 }} variant="in-rack" />);
    // eslint-disable-next-line no-undef
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('w-[var(--cell-size)]');
    expect(el.className).toContain('h-[var(--cell-size)]');
    expect(el.className).not.toMatch(/\bw-8\b|\bsm:w-9\b/);
  });
});
