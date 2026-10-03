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
