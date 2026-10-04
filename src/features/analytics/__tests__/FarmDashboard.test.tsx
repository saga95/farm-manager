import { render, screen } from '@testing-library/react';
import { FarmDashboard } from '../components/FarmDashboard';

describe('FarmDashboard (SCR-003)', () => {
  it('shows the four quick actions, with the plucking round first', () => {
    render(<FarmDashboard farmName='One-acre farm' />);
    const links = screen.getAllByRole('link').map(a => a.getAttribute('href'));
    expect(links.slice(0, 4)).toEqual([
      '/coconut/rounds/new',
      '/farm',
      '/sales/new',
      '/inventory',
    ]);
  });

  it('renders every §16 section as a labelled region', () => {
    render(<FarmDashboard farmName='One-acre farm' />);
    for (const key of [
      'coconut.title',
      'nextPlucking.title',
      'produce.title',
      'sales.title',
      'polytunnel.title',
      'inputs.title',
      'activity.title',
    ]) {
      expect(screen.getByRole('region', { name: key })).toBeInTheDocument();
    }
  });

  it('shows honest empty states instead of numbers (PR-007)', () => {
    render(<FarmDashboard farmName='One-acre farm' />);
    expect(screen.getByText('nextPlucking.empty')).toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });
});

describe('FarmDashboard live figures', () => {
  it('shows coconut, next-plucking and stock figures when data exists', () => {
    render(
      <FarmDashboard
        farmName='Farm'
        coconut={{ registered: 50, producing: 36 }}
        nextPlucking={{ overdue: 3, dueSoon: 6, noHistory: 20 }}
        produce={{ coconutsAvailable: 214 }}
      />
    );
    for (const n of ['50', '36', '3', '6', '214'])
      expect(screen.getByText(n)).toBeInTheDocument();
    expect(screen.queryByText('coconut.empty')).not.toBeInTheDocument();
  });

  it('keeps the honest empty state when nothing is due yet', () => {
    render(
      <FarmDashboard
        farmName='Farm'
        nextPlucking={{ overdue: 0, dueSoon: 0, noHistory: 50 }}
      />
    );
    expect(screen.getByText('nextPlucking.empty')).toBeInTheDocument();
  });
});
