import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from '../../src/ui/Sheet';

describe('<Sheet>', () => {
  it('タイトルと子要素を表示する', () => {
    render(
      <Sheet title="テスト" onDismiss={() => {}}>
        <p>本文</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'テスト' })).toBeInTheDocument();
    expect(screen.getByText('本文')).toBeInTheDocument();
  });

  it('モバイルは下寄せ、PC は中央寄せにする', () => {
    const { container } = render(
      <Sheet title="テスト" onDismiss={() => {}}>
        <p>本文</p>
      </Sheet>,
    );
    // eslint-disable-next-line no-undef
    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.className).toContain('items-end');
    expect(overlay.className).toContain('md:items-center');
  });

  it('背景タップで onDismiss を呼ぶ', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Sheet title="テスト" onDismiss={onDismiss}>
        <p>本文</p>
      </Sheet>,
    );
    // eslint-disable-next-line no-undef
    fireEvent.click(container.firstElementChild as HTMLElement);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('パネル内のクリックでは閉じない', () => {
    const onDismiss = vi.fn();
    render(
      <Sheet title="テスト" onDismiss={onDismiss}>
        <p>本文</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByText('本文'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('Escape で onDismiss を呼ぶ', () => {
    const onDismiss = vi.fn();
    render(
      <Sheet title="テスト" onDismiss={onDismiss}>
        <p>本文</p>
      </Sheet>,
    );
    // eslint-disable-next-line no-undef
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('開いたときパネルへフォーカスを移す', () => {
    render(
      <Sheet title="テスト" onDismiss={() => {}}>
        <p>本文</p>
      </Sheet>,
    );
    // eslint-disable-next-line no-undef
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('閉じたとき元の要素へフォーカスを戻す', () => {
    // eslint-disable-next-line no-undef
    const trigger = document.createElement('button');
    // eslint-disable-next-line no-undef
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(
      <Sheet title="テスト" onDismiss={() => {}}>
        <p>本文</p>
      </Sheet>,
    );
    unmount();
    // eslint-disable-next-line no-undef
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
