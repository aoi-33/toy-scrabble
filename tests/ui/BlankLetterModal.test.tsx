import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlankLetterModal } from '../../src/ui/BlankLetterModal';

describe('<BlankLetterModal>', () => {
  it('renders 26 letters', () => {
    render(<BlankLetterModal onSelect={() => {}} onCancel={() => {}} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(26);
  });
  it('calls onSelect with the picked letter', () => {
    const onSelect = vi.fn();
    render(<BlankLetterModal onSelect={onSelect} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'letter-M' }));
    expect(onSelect).toHaveBeenCalledWith('M');
  });

  it('文字ボタンが 44px 以上のタッチターゲットを持つ', () => {
    render(<BlankLetterModal onSelect={() => {}} onCancel={() => {}} />);
    const btn = screen.getByRole('button', { name: 'letter-A' });
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('min-h-[44px]');
  });

  it('キャンセルも 44px 以上のタッチターゲットを持つ', () => {
    render(<BlankLetterModal onSelect={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'キャンセル' }).className).toContain('min-h-[44px]');
  });
});
