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

  it('タッチでドラッグできるよう touch-action を無効化する', () => {
    render(<Rack rack={rack} selectedIndex={null} onSelect={() => {}} />);
    const btn = screen.getAllByRole('button')[0];
    expect(btn.style.touchAction).toBe('none');
  });

  it('タッチターゲットを 44px 以上にする', () => {
    render(<Rack rack={rack} selectedIndex={null} onSelect={() => {}} />);
    const btn = screen.getAllByRole('button')[0];
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('min-h-[44px]');
  });

  it('手札タイルには専用サイズを継承させる', () => {
    const { container } = render(<Rack rack={rack} selectedIndex={null} onSelect={() => {}} />);
    const inner = container.querySelector('[data-testid="rack-tiles"]') as HTMLElement;
    expect(inner.style.getPropertyValue('--cell-size')).toBe('var(--rack-tile-size)');
  });

  it('7 枚が入り切らない幅でも横スクロールで全部触れる', () => {
    // 44px * 7 + gap 4px * 6 + padding 8px * 2 = 348px > 320px 端末の内側幅
    const { container } = render(<Rack rack={rack} selectedIndex={null} onSelect={() => {}} />);
    const inner = container.querySelector('[data-testid="rack-tiles"]') as HTMLElement;
    expect(inner.className).toContain('max-w-full');
    expect(inner.className).toContain('overflow-x-auto');
    // タイルは潰れない
    expect(screen.getAllByRole('button')[0].className).toContain('shrink-0');
  });
});
