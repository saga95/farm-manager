import { render, screen, within } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { AppShell } from '../AppShell';

describe('AppShell', () => {
  beforeEach(() => {
    void mockRouter.push('/coconut/trees');
  });

  it('renders the page heading and content inside the main landmark', () => {
    render(
      <AppShell title='Trees'>
        <p>content</p>
      </AppShell>
    );
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(
      within(main).getByRole('heading', { level: 1, name: 'Trees' })
    ).toBeInTheDocument();
    expect(within(main).getByText('content')).toBeInTheDocument();
  });

  it('renders mobile and desktop navigation landmarks with all five tabs', () => {
    render(<AppShell title='Trees'>x</AppShell>);
    const navs = screen.getAllByRole('navigation', { name: 'nav.label' });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      for (const key of ['home', 'farm', 'inventory', 'sales', 'more']) {
        expect(
          within(nav).getByRole('link', { name: new RegExp(`nav.${key}`) })
        ).toBeInTheDocument();
      }
    }
  });

  it('marks the owning tab as the current page', () => {
    render(<AppShell title='Trees'>x</AppShell>);
    const current = screen
      .getAllByRole('link')
      .filter(link => link.getAttribute('aria-current') === 'page');
    expect(current.length).toBe(2);
    current.forEach(link => expect(link).toHaveAttribute('href', '/farm'));
  });

  it('can hide the quick actions', () => {
    const { rerender } = render(<AppShell title='Trees'>x</AppShell>);
    expect(
      screen.getByRole('button', { name: 'quickActions.open' })
    ).toBeInTheDocument();
    rerender(
      <AppShell title='Trees' showQuickActions={false}>
        x
      </AppShell>
    );
    expect(
      screen.queryByRole('button', { name: 'quickActions.open' })
    ).not.toBeInTheDocument();
  });
});
