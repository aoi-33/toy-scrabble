import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionBar } from '../../src/ui/ActionBar';

const noop = () => {};

function renderBar(overrides: Partial<Parameters<typeof ActionBar>[0]> = {}) {
  return render(
    <ActionBar
      canPlay
      canRecall
      onPlay={noop}
      onRecall={noop}
      onShuffle={noop}
      onPass={noop}
      onExchange={noop}
      {...overrides}
    />,
  );
}

describe('<ActionBar>', () => {
  it('すべてのボタンが 44px 以上のタッチターゲットを持つ', () => {
    renderBar();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
    for (const b of buttons) {
      expect(b.className).toContain('min-h-[44px]');
    }
  });

  it('PLAY は pending が無いとき無効になる', () => {
    renderBar({ canPlay: false });
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeDisabled();
  });

  it('PLAY クリックで onPlay を呼ぶ', () => {
    const onPlay = vi.fn();
    renderBar({ onPlay });
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(onPlay).toHaveBeenCalled();
  });
});
