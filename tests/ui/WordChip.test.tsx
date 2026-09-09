import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WordChip, MoveWords } from '../../src/ui/WordChip';
import type { MoveRecord } from '../../src/game/types';

const PLACE: MoveRecord = {
  player: 'P1',
  move: { kind: 'place', placements: [] },
  wordsFormed: ['CAT', 'AT'],
  score: 12,
};

const PASS: MoveRecord = {
  player: 'P1',
  move: { kind: 'pass' },
  wordsFormed: [],
  score: 0,
};

const EXCHANGE: MoveRecord = {
  player: 'COM',
  move: { kind: 'exchange', tileIndices: [0, 1] },
  wordsFormed: [],
  score: 0,
};

describe('WordChip', () => {
  it('単語を読み上げ可能なボタンとして出す', () => {
    render(<WordChip word="CAT" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CAT の意味を見る' })).toBeInTheDocument();
  });

  it('押すと単語つきでコールバックを呼ぶ', () => {
    const onSelect = vi.fn();
    render(<WordChip word="CAT" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'CAT の意味を見る' }));
    expect(onSelect).toHaveBeenCalledWith('CAT');
  });
});

describe('MoveWords', () => {
  it('place の手は作った単語ぶんチップを出す', () => {
    render(<MoveWords record={PLACE} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CAT の意味を見る' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AT の意味を見る' })).toBeInTheDocument();
  });

  it('pass の手にはチップを出さない', () => {
    const { container } = render(<MoveWords record={PASS} onSelect={() => {}} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('同じ単語を 2 つ作った手でも key が衝突しない', () => {
    // 交差語は配置ごとに push されるので（rules.ts）同じ語が 2 回入りうる
    const duplicated: MoveRecord = { ...PLACE, wordsFormed: ['AT', 'AT'] };
    // eslint-disable-next-line no-undef
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<MoveWords record={duplicated} onSelect={() => {}} />);
    expect(screen.getAllByRole('button', { name: 'AT の意味を見る' })).toHaveLength(2);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('exchange の手にはチップを出さない', () => {
    const { container } = render(<MoveWords record={EXCHANGE} onSelect={() => {}} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
