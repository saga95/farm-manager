import { fireEvent, render, screen } from '@testing-library/react';
import type { Tree } from '@/lib/api';
import { BackfillRoundForm } from '../components/BackfillRoundForm';

const trees: Tree[] = ['C-002', 'C-001', 'C-003'].map((code, i) => ({
  id: `t${i}`,
  tenantId: 't',
  farmId: 'f',
  code,
  cropCode: 'COCONUT',
  status: 'PRODUCING',
  version: 1,
}));

const setup = () => {
  const onSubmit = jest.fn();
  render(
    <BackfillRoundForm
      trees={trees}
      today='2026-10-05'
      saving={false}
      onSubmit={onSubmit}
    />
  );
  return onSubmit;
};
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'round.save' }));

describe('BackfillRoundForm (#101)', () => {
  it('lists trees in code order and saves only the trees given a count', () => {
    const onSubmit = setup();
    expect(
      screen
        .getAllByLabelText(/^round.count/)
        .map(el => el.getAttribute('id') !== null)
    ).toHaveLength(3);
    fireEvent.change(screen.getByLabelText(/round.date/), {
      target: { value: '2026-03-01' },
    });
    const fields = screen.getAllByLabelText(/^round.count/);
    fireEvent.change(fields[0]!, { target: { value: '20' } }); // C-001
    fireEvent.change(fields[2]!, { target: { value: '15' } }); // C-003
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'round.approx C-003' })
    );
    fireEvent.change(screen.getByLabelText(/round.unattributed/), {
      target: { value: '40' },
    });
    expect(screen.getByText('round.total')).toBeInTheDocument();
    save();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        roundDate: '2026-03-01',
        source: 'WHATSAPP_BACKFILL',
        entries: [
          { treeId: 't1', quantity: 20, approximate: false },
          { treeId: 't2', quantity: 15, approximate: true },
        ],
        unattributedQuantity: 40,
        addToStock: false,
        excludeFromPrediction: false,
      })
    );
  });

  it('needs a past date and something to save', () => {
    const onSubmit = setup();
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('round.future');
    fireEvent.change(screen.getByLabelText(/round.date/), {
      target: { value: '2026-03-01' },
    });
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('round.empty');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
