import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScorePanel } from '../../src/ui/ScorePanel';

describe('<ScorePanel>', () => {
  it('renders both scores and bag remaining', () => {
    render(<ScorePanel p1Score={12} comScore={34} bagRemaining={56} currentPlayerId="P1" />);
    expect(screen.getByText(/P1/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText(/56/)).toBeInTheDocument();
  });

  it('marks the current player', () => {
    render(<ScorePanel p1Score={0} comScore={0} bagRemaining={100} currentPlayerId="COM" />);
    expect(screen.getByLabelText('current-player-COM')).toBeInTheDocument();
  });

  it('横幅いっぱいに広がる', () => {
    const { container } = render(
      <ScorePanel p1Score={0} comScore={0} bagRemaining={100} currentPlayerId="P1" />,
    );
    // eslint-disable-next-line no-undef
    expect((container.firstElementChild as HTMLElement).className).toContain('w-full');
  });
});
