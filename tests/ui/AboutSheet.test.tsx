import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AboutSheet } from '../../src/ui/AboutSheet';

describe('AboutSheet', () => {
  it('ダイアログとして開く', () => {
    render(<AboutSheet onDismiss={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'ABOUT' })).toBeInTheDocument();
  });

  // WordNet ライセンスは著作権表示と免責を全コピーに添付することを配布条件にしている。
  // 画面内表示はその義務を満たすためのものなので、文言が消えたら失敗させる。
  it('WordNet の著作権表示を原文どおり出す', () => {
    render(<AboutSheet onDismiss={() => {}} />);
    expect(
      screen.getByText(/WordNet 3\.0 Copyright 2006 by Princeton University\./),
    ).toBeInTheDocument();
  });

  it('WordNet の無保証免責を出す', () => {
    render(<AboutSheet onDismiss={() => {}} />);
    expect(screen.getByText(/PROVIDED "AS IS"/)).toBeInTheDocument();
    expect(screen.getByText(/NO REPRESENTATIONS OR WARRANTIES/)).toBeInTheDocument();
  });

  it('単語リストが CC0 であることと TWL06 でないことを明示する', () => {
    render(<AboutSheet onDismiss={() => {}} />);
    expect(screen.getByText(/CC0/)).toBeInTheDocument();
    expect(screen.getByText(/TWL06/)).toBeInTheDocument();
  });

  it('EJDict と Press Start 2P も挙げる', () => {
    render(<AboutSheet onDismiss={() => {}} />);
    expect(screen.getByText(/EJDict/)).toBeInTheDocument();
    expect(screen.getByText(/Press Start 2P/)).toBeInTheDocument();
  });

  it('閉じるボタンで onDismiss を呼ぶ', () => {
    const onDismiss = vi.fn();
    render(<AboutSheet onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
