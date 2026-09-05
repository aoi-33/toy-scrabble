import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExchangeModal } from '../../src/ui/ExchangeModal';
import type { Tile } from '../../src/game/types';

const rack: Tile[] = [
  { kind: 'letter', letter: 'A', points: 1 },
  { kind: 'letter', letter: 'B', points: 3 },
  { kind: 'letter', letter: 'C', points: 3 },
];

describe('<ExchangeModal>', () => {
  it('OK is disabled until at least one tile is selected', () => {
    render(<ExchangeModal rack={rack} onConfirm={() => {}} onCancel={() => {}} />);
    const ok = screen.getByRole('button', { name: /OK/ });
    expect(ok).toBeDisabled();
    fireEvent.click(screen.getByLabelText('exchange-tile-0'));
    expect(ok).not.toBeDisabled();
  });

  it('OK confirms selected indices', () => {
    const onConfirm = vi.fn();
    render(<ExchangeModal rack={rack} onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByLabelText('exchange-tile-0'));
    fireEvent.click(screen.getByLabelText('exchange-tile-2'));
    fireEvent.click(screen.getByRole('button', { name: /OK/ }));
    expect(onConfirm).toHaveBeenCalledWith([0, 2]);
  });

  it('Cancel calls onCancel', () => {
    const onCancel = vi.fn();
    render(<ExchangeModal rack={rack} onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /キャンセル/ }));
    expect(onCancel).toHaveBeenCalled();
  });
});
