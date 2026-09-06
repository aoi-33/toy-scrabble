import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useState, useCallback } from 'react';
import type { Move } from '../../src/game/types';

const requestMove = vi.fn<(snapshot: unknown, difficulty: unknown) => Promise<Move>>();

// 実ワーカーと同じく「dispatch より先に ready へ戻る」挙動を再現する
vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => {
    const [state, setState] = useState<'ready' | 'thinking'>('ready');
    const request = useCallback((snapshot: unknown, difficulty: unknown) => {
      setState('thinking');
      const promise = requestMove(snapshot, difficulty);
      promise.then(() => setState('ready'));
      return promise;
    }, []);
    return { state, requestMove: request };
  },
}));

import App from '../../src/App';

describe('COM の手番', () => {
  beforeEach(() => {
    requestMove.mockReset();
    requestMove.mockImplementation(
      // eslint-disable-next-line no-undef
      () => new Promise(resolve => setTimeout(() => resolve({ kind: 'pass' }), 10)),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => 'CAT\nDOG\n' }));
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1 手番につき AI へ依頼するのは 1 回だけ', async () => {
    render(<App />);
    const easy = await screen.findByLabelText('mode-com-easy');
    await waitFor(() => expect(easy).not.toBeDisabled());
    fireEvent.click(easy);

    fireEvent.click(screen.getByText('PASS'));

    await waitFor(() => expect(requestMove).toHaveBeenCalledTimes(1));
    // COM の手が確定した後も再依頼が走らないこと（走ると COM が P1 の手番も打ち続ける）
    // eslint-disable-next-line no-undef
    await act(() => new Promise(resolve => setTimeout(resolve, 1200)));
    expect(requestMove).toHaveBeenCalledTimes(1);
  });
});
