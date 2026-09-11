import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RulesSheet } from '../../src/ui/RulesSheet';

describe('RulesSheet', () => {
  it('ダイアログとして開く', () => {
    render(<RulesSheet onDismiss={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'RULES' })).toBeInTheDocument();
  });

  // 配置エラーの文言だけ見ても理由が分からないので、制約は全部並べる
  it('配置の制約を挙げる', () => {
    render(<RulesSheet onDismiss={() => {}} />);
    expect(screen.getByText(/同じ行か同じ列に一直線/)).toBeInTheDocument();
    expect(screen.getByText(/初手は中央/)).toBeInTheDocument();
    expect(screen.getByText(/既存のタイルに隣接/)).toBeInTheDocument();
    expect(screen.getByText(/縦横どちらも辞書に載っている/)).toBeInTheDocument();
  });

  it('プレミアムマスと 7 枚ボーナスを挙げる', () => {
    render(<RulesSheet onDismiss={() => {}} />);
    expect(screen.getByText(/DL \/ TL はその文字が 2 倍 \/ 3 倍/)).toBeInTheDocument();
    expect(screen.getByText(/\+50 点/)).toBeInTheDocument();
  });

  it('交換とパスの条件を挙げる', () => {
    render(<RulesSheet onDismiss={() => {}} />);
    expect(screen.getByText(/袋に 7 枚以上/)).toBeInTheDocument();
    expect(screen.getByText(/6 回連続/)).toBeInTheDocument();
  });

  // 手札の残りが減点になることは得点に直結するのに、画面のどこにも出ていない
  it('終了時の精算を挙げる', () => {
    render(<RulesSheet onDismiss={() => {}} />);
    expect(screen.getByText(/自分の得点から引かれます/)).toBeInTheDocument();
  });

  it('閉じるボタンで onDismiss を呼ぶ', () => {
    const onDismiss = vi.fn();
    render(<RulesSheet onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
