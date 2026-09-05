import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Rack } from '../../src/ui/Rack';
import type { Tile } from '../../src/game/types';

const rack: Tile[] = [
  { kind: 'letter', letter: 'A', points: 1 },
  { kind: 'letter', letter: 'B', points: 3 },
  { kind: 'blank', assigned: null, points: 0 },
];

describe('<Rack>', () => {
  it('renders one tile per rack entry', () => {
    render(<Rack rack={rack} selectedIndex={null} onSelect={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('calls onSelect with the tile index on click', () => {
    const onSelect = vi.fn();
    render(<Rack rack={rack} selectedIndex={null} onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('highlights the selected tile', () => {
    render(<Rack rack={rack} selectedIndex={0} onSelect={() => {}} />);
    const btn = screen.getAllByRole('button')[0];
    expect(btn.className).toMatch(/ring/);
  });
});
