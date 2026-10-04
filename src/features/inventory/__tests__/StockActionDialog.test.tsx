import { fireEvent, render, screen } from '@testing-library/react';
import { MovementList } from '../components/MovementList';
import { StockActionDialog } from '../components/StockActionDialog';

jest.mock('@mui/material/useMediaQuery', () => () => false);

const setup = (
  props: Partial<Parameters<typeof StockActionDialog>[0]> = {}
) => {
  const onSave = jest.fn();
  render(
    <StockActionDialog
      open
      action='dehusk'
      available={{ HUSKED: 120, DEHUSKED: 0 }}
      today='2026-10-04'
      saving={false}
      onSave={onSave}
      onClose={jest.fn()}
      {...props}
    />
  );
  return onSave;
};
const qty = (v: string) =>
  fireEvent.change(screen.getByLabelText('dialog.quantity'), {
    target: { value: v },
  });
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'dialog.save' }));

describe('StockActionDialog (#77, #78)', () => {
  it('dehusks husked nuts', () => {
    const onSave = setup();
    expect(screen.getByText('dialog.available')).toBeInTheDocument();
    qty('30');
    save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionType: 'PROCESSING',
        state: 'HUSKED',
        quantity: 30,
        transactionDate: '2026-10-04',
      })
    );
  });

  it('never asks for more than is available (AC-IN-002)', () => {
    const onSave = setup();
    qty('121');
    save();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'dialog.invalidQuantity'
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('records household use of dehusked nuts', () => {
    const onSave = setup({
      action: 'move',
      available: { HUSKED: 90, DEHUSKED: 30 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'produce.dehusked' }));
    qty('4');
    save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionType: 'HOUSEHOLD_USE',
        state: 'DEHUSKED',
        quantity: 4,
        notes: null,
      })
    );
  });

  it('adjustments need a reason (AC-IN-004)', () => {
    const onSave = setup({ action: 'move' });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'dialog.type' }));
    fireEvent.click(screen.getByRole('option', { name: 'txn.ADJUSTMENT_OUT' }));
    qty('2');
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('dialog.needReason');
    fireEvent.change(screen.getByLabelText(/dialog.reason/), {
      target: { value: 'Recount' },
    });
    save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionType: 'ADJUSTMENT_OUT',
        notes: 'Recount',
      })
    );
  });
});

describe('MovementList (SCR-016)', () => {
  it('describes each movement in words with a signed quantity', () => {
    render(
      <MovementList
        label='Movements'
        transactions={[
          {
            id: '1',
            batchId: 'b',
            transactionType: 'PROCESSING',
            quantity: 30,
            unit: 'NUT',
            transactionDate: '2026-10-04',
          },
          {
            id: '2',
            batchId: 'b',
            transactionType: 'HARVEST_IN',
            quantity: 120,
            unit: 'NUT',
            state: 'HUSKED',
            transactionDate: '2026-10-01',
          },
        ]}
      />
    );
    expect(screen.getByRole('list', { name: 'Movements' })).toBeInTheDocument();
    expect(screen.getByText('txn.PROCESSING')).toBeInTheDocument();
    expect(screen.getByText('txn.moved')).toBeInTheDocument();
    expect(screen.getByText('txn.in')).toBeInTheDocument();
  });
});
