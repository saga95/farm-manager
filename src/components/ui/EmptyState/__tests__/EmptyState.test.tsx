import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('shows the message and an action link', () => {
    render(
      <EmptyState
        message='No trees registered yet.'
        action={{ label: 'Register trees', href: '/coconut/trees/bulk' }}
      />
    );
    expect(screen.getByText('No trees registered yet.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Register trees' })
    ).toHaveAttribute('href', '/coconut/trees/bulk');
  });

  it('renders a heading only when a title is given', () => {
    const { rerender } = render(<EmptyState message='m' />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    rerender(<EmptyState message='m' title='Coming soon' size='page' />);
    expect(
      screen.getByRole('heading', { name: 'Coming soon' })
    ).toBeInTheDocument();
  });
});
