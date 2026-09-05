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
});
