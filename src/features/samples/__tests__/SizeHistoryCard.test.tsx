import { render, screen } from '@testing-library/react';
import { SizeHistoryCard } from '../components/SizeHistoryCard';

const counts = { SMALL: 0, MEDIUM: 1, LARGE: 4, UNCLASSIFIED: 0 };

describe('SizeHistoryCard (AC-SM-003)', () => {
  it('words the tendency as sample evidence', () => {
    render(
      <SizeHistoryCard
        history={{
          latest: 'LARGE',
          latestDate: '2026-09-10',
          sampleCount: 5,
          counts,
          recent: ['LARGE', 'LARGE', 'MEDIUM', 'LARGE', 'LARGE'],
          tendency: 'LARGE',
          tendencyMatches: 4,
        }}
      />
    );
    expect(screen.getByText('history.latestOn')).toBeInTheDocument();
    expect(screen.getByText('history.tendency')).toBeInTheDocument();
    expect(screen.getByText('history.evidence')).toBeInTheDocument();
  });

  it('says "not sampled yet" with no samples, and no tendency with too few', () => {
    const { rerender } = render(
      <SizeHistoryCard
        history={{
          sampleCount: 0,
          counts: { ...counts, MEDIUM: 0, LARGE: 0 },
          recent: [],
          tendencyMatches: 0,
        }}
      />
    );
    expect(screen.getByText('history.never')).toBeInTheDocument();
    rerender(
      <SizeHistoryCard
        history={{
          latest: 'SMALL',
          sampleCount: 1,
          counts: { ...counts, MEDIUM: 0, LARGE: 0, SMALL: 1 },
          recent: ['SMALL'],
          tendencyMatches: 0,
        }}
      />
    );
    expect(screen.getByText('history.noTendency')).toBeInTheDocument();
  });
});
