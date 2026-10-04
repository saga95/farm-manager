import { fireEvent, render, screen } from '@testing-library/react';
import { EntityList } from '@/features/farm/components/EntityList';
import type { InputItem } from '@/lib/api';
import { InputItemDialog } from '../components/InputItemDialog';
import { InputMovementDialog } from '../components/InputMovementDialog';

jest.mock('@mui/material/useMediaQuery', () => () => false);

const item: InputItem = {
  id: 'i1',
  farmId: 'f',
  name: 'Urea',
  category: 'FERTILIZER',
  unit: 'KG',
  quantity: 4,
  reorderLevel: 5,
  lowStock: true,
  status: 'ACTIVE',
  version: 3,
};
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'inputDialog.save' }));

describe('InputMovementDialog (#80)', () => {
  const setup = (type: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT') => {
    const onSave = jest.fn();
    render(
      <InputMovementDialog
        open
        type={type}
        item={item}
        today='2026-10-04'
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    return onSave;
  };
  const qty = (v: string) =>
    fireEvent.change(screen.getByLabelText('inputDialog.quantity'), {
      target: { value: v },
    });

  it('uses decimal quantities but never more than in stock', () => {
    const onSave = setup('STOCK_OUT');
    qty('4.5');
    save();
    expect(screen.getByText('inputDialog.tooMuch')).toBeInTheDocument();
    qty('2.5');
    save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionType: 'STOCK_OUT',
        quantity: 2.5,
        decrease: false,
      })
    );
  });

  it('an adjustment needs a reason and can remove stock', () => {
    const onSave = setup('ADJUSTMENT');
    fireEvent.click(
      screen.getByRole('button', { name: 'inputDialog.decrease' })
    );
    qty('1');
    save();
    expect(screen.getByText('inputDialog.needReason')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/inputDialog.reason/), {
      target: { value: 'Spilled' },
    });
    save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        decrease: true,
        reason: 'Spilled',
        notes: null,
      })
    );
  });
});

describe('InputItemDialog (#80)', () => {
  it('needs a name; sends the opening stock', () => {
    const onSave = jest.fn();
    render(
      <InputItemDialog
        open
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    save();
    expect(screen.getByText('inputDialog.needName')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/inputDialog.name/), {
      target: { value: 'Urea' },
    });
    fireEvent.change(screen.getByLabelText('inputDialog.opening'), {
      target: { value: '25' },
    });
    save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Urea',
        unit: 'KG',
        category: 'FERTILIZER',
      }),
      25
    );
  });

  it('locks the unit when editing', () => {
    render(
      <InputItemDialog
        open
        item={item}
        saving={false}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('inputDialog.unitFixed')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('inputDialog.opening')
    ).not.toBeInTheDocument();
  });
});

describe('low stock badge (#81: not colour alone)', () => {
  it('shows the text with an icon', () => {
    render(
      <EntityList
        label='Inputs'
        rows={[
          {
            id: 'i1',
            primary: 'Urea',
            badge: 'Low stock',
            badgeTone: 'warning',
          },
        ]}
      />
    );
    const chip = screen.getByText('Low stock').closest('.MuiChip-root')!;
    expect(chip.querySelector('svg')).not.toBeNull();
  });
});
