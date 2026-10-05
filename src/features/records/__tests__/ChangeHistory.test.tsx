import { render, screen } from '@testing-library/react';
import { ChangeList, changeLines } from '../ChangeHistory';

describe('change history (#105)', () => {
  it('lists only fields that changed', () => {
    expect(
      changeLines({
        before: { quantity: 20, notes: 'a' },
        after: { quantity: 22, notes: 'a' },
      })
    ).toEqual([{ field: 'quantity', before: '20', after: '22' }]);
    expect(changeLines({ source: 'WHATSAPP_BACKFILL' })).toEqual([]);
  });

  it('shows the action, who and when, the change and the reason', () => {
    render(
      <ChangeList
        entries={[
          {
            id: '1',
            at: '2026-10-05T03:00:00.000Z',
            action: 'harvest.correct',
            entityId: 'h1',
            actorId: 'u1',
            actorEmail: 'owner@farm.lk',
            details: {
              before: { quantity: 20 },
              after: { quantity: 22 },
              reason: 'Recount',
            },
          },
        ]}
      />
    );
    expect(screen.getByText('action.harvest.correct')).toBeInTheDocument();
    expect(screen.getByText('history.change')).toBeInTheDocument();
    expect(screen.getByText('history.reason')).toBeInTheDocument();
  });

  it('says when there is nothing yet', () => {
    render(<ChangeList entries={[]} />);
    expect(screen.getByText('history.empty')).toBeInTheDocument();
  });
});
