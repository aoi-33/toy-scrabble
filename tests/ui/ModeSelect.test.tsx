import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeSelect } from '../../src/ui/ModeSelect';

describe('<ModeSelect>', () => {
  it('renders all 4 mode buttons', () => {
    render(<ModeSelect disabled={false} onSelect={() => {}} />);
    expect(screen.getByLabelText('mode-free')).toBeInTheDocument();
    expect(screen.getByLabelText('mode-com-easy')).toBeInTheDocument();
    expect(screen.getByLabelText('mode-com-medium')).toBeInTheDocument();
    expect(screen.getByLabelText('mode-com-hard')).toBeInTheDocument();
  });

  it('COM modes are disabled', () => {
    render(<ModeSelect disabled={false} onSelect={() => {}} />);
    expect(screen.getByLabelText('mode-free')).not.toBeDisabled();
    expect(screen.getByLabelText('mode-com-easy')).toBeDisabled();
    expect(screen.getByLabelText('mode-com-medium')).toBeDisabled();
    expect(screen.getByLabelText('mode-com-hard')).toBeDisabled();
  });

  it('calls onSelect with the selected mode when Free is clicked', () => {
    const onSelect = vi.fn();
    render(<ModeSelect disabled={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('mode-free'));
    expect(onSelect).toHaveBeenCalledWith('free');
  });

  it('disables all buttons when disabled prop is true (dict loading)', () => {
    render(<ModeSelect disabled={true} onSelect={() => {}} />);
    expect(screen.getByLabelText('mode-free')).toBeDisabled();
    expect(screen.getByLabelText('mode-com-easy')).toBeDisabled();
  });
});
