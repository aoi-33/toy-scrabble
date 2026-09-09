import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => ({ state: 'ready' as const, requestMove: vi.fn() }),
}));

import App from '../../src/App';

describe('App の About 表示', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => 'CAT\nDOG\n' }));
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('モード選択画面に ABOUT ボタンがある', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: 'ABOUT' })).toBeInTheDocument();
  });

  it('起動直後は About が開いていない', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'ABOUT' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ABOUT を押すとライセンスのダイアログが開く', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'ABOUT' }));
    expect(screen.getByRole('dialog', { name: 'ABOUT' })).toBeInTheDocument();
    expect(
      screen.getByText(/WordNet 3\.0 Copyright 2006 by Princeton University\./),
    ).toBeInTheDocument();
  });

  it('閉じるとダイアログが消える', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'ABOUT' }));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
