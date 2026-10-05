import { fireEvent, render, screen } from '@testing-library/react';
import type { Buyer, ProduceBatch } from '@/lib/api';
import { SaleForm } from '../components/SaleForm';

const batches: ProduceBatch[] = [
  {
    id: 'b-new',
    cropCode: 'COCONUT',
    sourceType: 'PLUCKING_ROUND',
    batchDate: '2026-10-03',
    quantityReceived: 50,
    unit: 'NUT',
    available: 50,
    availableByState: { HUSKED: 50, DEHUSKED: 0 },
    status: 'AVAILABLE',
    version: 1,
  },
  {
    id: 'b-old',
    cropCode: 'COCONUT',
    sourceType: 'PLUCKING_ROUND',
    batchDate: '2026-10-01',
    quantityReceived: 30,
    unit: 'NUT',
    available: 30,
    availableByState: { HUSKED: 30, DEHUSKED: 0 },
    status: 'AVAILABLE',
    version: 1,
  },
];
const buyers: Buyer[] = [
  {
    id: 'r1',
    name: 'Lake View Restaurant',
    preferredSizes: ['MEDIUM'],
    acceptableSizes: [],
    status: 'ACTIVE',
    version: 1,
  },
];

const setup = () => {
  const onSubmit = jest.fn();
  render(
    <SaleForm
      buyers={buyers}
      batches={batches}
      currency='LKR'
      today='2026-10-04'
      initialBuyerId='r1'
      saving={false}
      onSubmit={onSubmit}
      onCancel={jest.fn()}
    />
  );
  return onSubmit;
};
const typeIn = (label: string, value: string, index = 0) =>
  fireEvent.change(screen.getAllByLabelText(label)[index]!, {
    target: { value },
  });
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

describe('SaleForm (SCR-021, #86)', () => {
  it('shows the buyer preference and fills stock oldest first', () => {
    const onSubmit = setup();
    expect(screen.getByText('form.buyerPrefers')).toBeInTheDocument();
    typeIn('form.quantity', '40');
    typeIn('form.price', '120');
    fireEvent.click(screen.getByRole('button', { name: 'form.fill' }));
    save();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerId: 'r1',
        saleDate: '2026-10-04',
        lines: [{ sizeClass: null, quantity: 40, unitPrice: 120 }],
        allocations: [
          { batchId: 'b-old', state: 'HUSKED', quantity: 30 },
          { batchId: 'b-new', state: 'HUSKED', quantity: 10 },
        ],
        actualAmountReceived: null,
      })
    );
  });

  it('sold and taken-from-stock must match', () => {
    const onSubmit = setup();
    typeIn('form.quantity', '10');
    typeIn('form.price', '100');
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('form.errors.mismatch');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps calculated and actual apart and asks why they differ', () => {
    const onSubmit = setup();
    typeIn('form.quantity', '10');
    typeIn('form.price', '100');
    fireEvent.click(screen.getByRole('button', { name: 'form.fill' }));
    typeIn('form.actual', '950');
    expect(screen.getByText('form.difference')).toBeInTheDocument();
    typeIn('form.differenceReason', 'Discount');
    save();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        actualAmountReceived: 950,
        differenceReason: 'Discount',
      })
    );
  });

  it('adds and removes lines', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'form.addLine' }));
    expect(screen.getAllByLabelText('form.quantity')).toHaveLength(2);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'form.removeLine' })[1]!
    );
    expect(screen.getAllByLabelText('form.quantity')).toHaveLength(1);
  });
});

describe('SaleForm for polytunnel produce (#96, AC-PT-005)', () => {
  const cucumber: ProduceBatch = {
    id: 'cu1',
    cropCode: 'CUCUMBER',
    cropName: 'Cucumber',
    sourceType: 'GENERIC_HARVEST',
    batchDate: '2026-04-10',
    quantityReceived: 12.5,
    unit: 'KG',
    available: 12.5,
    availableByState: { FRESH: 12.5 },
    status: 'AVAILABLE',
    version: 1,
  };

  it('sells kg without size lines from fresh stock', () => {
    const onSubmit = jest.fn();
    render(
      <SaleForm
        buyers={buyers}
        batches={[...batches, cucumber]}
        currency='LKR'
        today='2026-04-12'
        saving={false}
        onSubmit={onSubmit}
        onCancel={jest.fn()}
      />
    );
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'form.crop' }));
    fireEvent.click(screen.getByRole('option', { name: 'Cucumber' }));
    expect(screen.queryByLabelText('form.size')).not.toBeInTheDocument();
    typeIn('form.quantityUnit', '10.5');
    typeIn('form.price', '480');
    fireEvent.click(screen.getByRole('button', { name: 'form.fill' }));
    save();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [{ sizeClass: null, quantity: 10.5, unitPrice: 480 }],
        allocations: [{ batchId: 'cu1', state: 'FRESH', quantity: 10.5 }],
      })
    );
  });
});

describe('SaleForm for a past sale (#101)', () => {
  it('has no stock section and saves without taking stock', () => {
    const onSubmit = jest.fn();
    render(
      <SaleForm
        backfill
        buyers={buyers}
        batches={[]}
        currency='LKR'
        today='2026-10-05'
        saving={false}
        onSubmit={onSubmit}
        onCancel={jest.fn()}
      />
    );
    expect(screen.queryByText('form.stock')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('form.date'), {
      target: { value: '2026-02-14' },
    });
    typeIn('form.quantity', '23');
    typeIn('form.price', '140');
    save();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        saleDate: '2026-02-14',
        allocations: [],
        lines: [{ sizeClass: null, quantity: 23, unitPrice: 140 }],
      })
    );
  });
});
