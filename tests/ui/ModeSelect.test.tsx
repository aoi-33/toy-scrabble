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

  it('COM modes are enabled by default', () => {
    render(<ModeSelect disabled={false} onSelect={() => {}} />);
    expect(screen.getByLabelText('mode-free')).not.toBeDisabled();
    expect(screen.getByLabelText('mode-com-easy')).not.toBeDisabled();
    expect(screen.getByLabelText('mode-com-medium')).not.toBeDisabled();
    expect(screen.getByLabelText('mode-com-hard')).not.toBeDisabled();
  });

  it('calls onSelect with the selected mode when Free is clicked', () => {
    const onSelect = vi.fn();
    render(<ModeSelect disabled={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('mode-free'));
    expect(onSelect).toHaveBeenCalledWith('free');
  });

  it('calls onSelect with the correct COM mode', () => {
    const onSelect = vi.fn();
    render(<ModeSelect disabled={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('mode-com-hard'));
    expect(onSelect).toHaveBeenCalledWith('com-hard');
  });

  it('disables all buttons when disabled prop is true (dict loading)', () => {
    render(<ModeSelect disabled={true} onSelect={() => {}} />);
    expect(screen.getByLabelText('mode-free')).toBeDisabled();
    expect(screen.getByLabelText('mode-com-easy')).toBeDisabled();
  });
});
