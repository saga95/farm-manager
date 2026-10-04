import { fireEvent, render, screen } from '@testing-library/react';
import { StatTile } from '@/components/ui/StatTile/StatTile';
import { PredictionCard } from '../components/PredictionCard';

const base = {
  methodVersion: 'median-v1',
  intervalCount: 4,
  harvestCount: 5,
  lastHarvestDate: '2026-08-20',
  medianIntervalDays: 63,
  variability: 0.1,
  highlyInconsistent: false,
  estimateDate: '2026-10-22',
  windowStart: '2026-10-18',
  windowEnd: '2026-10-26',
};

describe('PredictionCard (PR-006, AC-PD-004/005)', () => {
  it('shows the estimate and explains it on demand', () => {
    render(<PredictionCard prediction={{ ...base, confidence: 'MEDIUM' }} />);
    expect(screen.getByText('prediction.estimate')).toBeInTheDocument();
    expect(
      screen.getByText('prediction.confidence.MEDIUM')
    ).toBeInTheDocument();
    const why = screen.getByRole('button', { name: 'prediction.why' });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('prediction.explain')).toBeInTheDocument();
  });

  it('mentions the confidence downgrade for inconsistent trees', () => {
    render(
      <PredictionCard
        prediction={{ ...base, confidence: 'LOW', highlyInconsistent: true }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'prediction.why' }));
    expect(screen.getByText('prediction.inconsistent')).toBeInTheDocument();
  });

  it('says "not enough history" instead of guessing', () => {
    render(
      <PredictionCard
        prediction={{
          ...base,
          confidence: 'NO_PREDICTION',
          estimateDate: null,
          intervalCount: 0,
          medianIntervalDays: null,
        }}
      />
    );
    expect(screen.getByText('prediction.notEnough')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'prediction.why' })
    ).not.toBeInTheDocument();
  });
});

describe('StatTile', () => {
  it('shows missing values as an em dash, never 0', () => {
    render(<StatTile label='Best harvest' value={null} unit='nuts' />);
    expect(
      screen.getByRole('group', { name: 'Best harvest' })
    ).toHaveTextContent('—');
    expect(screen.queryByText('nuts')).not.toBeInTheDocument();
  });
  it('shows a recorded zero as 0', () => {
    render(<StatTile label='Last harvest' value={0} unit='nuts' />);
    expect(
      screen.getByRole('group', { name: 'Last harvest' })
    ).toHaveTextContent('0nuts');
  });
});
