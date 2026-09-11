import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DefinitionSheet } from '../../src/ui/DefinitionSheet';
import type { DictLoader } from '../../src/lookup/dictLoader';
import type { LookupResult } from '../../src/lookup/types';

function loaderOf(...results: LookupResult[]): DictLoader {
  let call = 0;
  return { lookup: vi.fn(async () => results[Math.min(call++, results.length - 1)]) };
}

const CAT: LookupResult = {
  kind: 'found',
  word: 'CAT',
  base: null,
  english: [
    ['n', 'feline mammal'],
    ['v', 'to flog with a cat-o-nine-tails'],
  ],
  japanese: ['猫', 'ネコ科の動物'],
};

const CATS: LookupResult = { ...CAT, word: 'CATS', base: 'CAT' };

describe('DefinitionSheet', () => {
  it('取得中はスケルトンを出す', () => {
    // 解決しない Promise で loading に留める
    const loader: DictLoader = { lookup: () => new Promise(() => {}) };
    render(<DefinitionSheet loader={loader} word="CAT" onDismiss={() => {}} />);
    expect(screen.getByTestId('definition-loading')).toBeInTheDocument();
  });

  it('英英と和訳を品詞ラベルつきで出す', async () => {
    render(<DefinitionSheet loader={loaderOf(CAT)} word="CAT" onDismiss={() => {}} />);
    expect(await screen.findByText('feline mammal')).toBeInTheDocument();
    expect(screen.getByText('n.')).toBeInTheDocument();
    expect(screen.getByText('v.')).toBeInTheDocument();
    expect(screen.getByText('猫')).toBeInTheDocument();
    expect(screen.getByText('ネコ科の動物')).toBeInTheDocument();
  });

  // WordNet は名詞・動詞・形容詞・副詞しか持たず、IF / OF / AND の意味が出せなかった。
  // Wiktionary で補った機能語の品詞がラベルまで届いていることを確かめる
  it('機能語の品詞ラベルも出す', async () => {
    const IF: LookupResult = {
      kind: 'found',
      word: 'IF',
      base: null,
      english: [
        ['conj', 'Supposing that, assuming that.'],
        ['prep', 'Expressing distance or motion.'],
        ['intj', 'An expression of surprise.'],
        ['x', 'A particle.'],
      ],
      japanese: [],
    };
    render(<DefinitionSheet loader={loaderOf(IF)} word="IF" onDismiss={() => {}} />);
    expect(await screen.findByText('Supposing that, assuming that.')).toBeInTheDocument();
    expect(screen.getByText('conj.')).toBeInTheDocument();
    expect(screen.getByText('prep.')).toBeInTheDocument();
    expect(screen.getByText('int.')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('原形が異なるときは併記する', async () => {
    render(<DefinitionSheet loader={loaderOf(CATS)} word="CATS" onDismiss={() => {}} />);
    expect(await screen.findByText('CATS ← CAT')).toBeInTheDocument();
  });

  it('原形が同じときは併記しない', async () => {
    render(<DefinitionSheet loader={loaderOf(CAT)} word="CAT" onDismiss={() => {}} />);
    await screen.findByText('feline mammal');
    expect(screen.queryByText(/←/)).not.toBeInTheDocument();
  });

  it('未収録語のメッセージを出す', async () => {
    render(
      <DefinitionSheet loader={loaderOf({ kind: 'not-found' })} word="ZZZZ" onDismiss={() => {}} />,
    );
    expect(await screen.findByText('この単語の意味は収録されていません')).toBeInTheDocument();
  });

  it('失敗時はメッセージと再試行ボタンを出し、押すと引き直す', async () => {
    const loader = loaderOf({ kind: 'error' }, CAT);
    render(<DefinitionSheet loader={loader} word="CAT" onDismiss={() => {}} />);
    expect(await screen.findByText('読み込みに失敗しました')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    await waitFor(() => expect(screen.getByText('feline mammal')).toBeInTheDocument());
  });

  it('シートのタイトルは単語そのもの', async () => {
    render(<DefinitionSheet loader={loaderOf(CAT)} word="CAT" onDismiss={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'CAT' })).toBeInTheDocument();
  });
});
