import { fireEvent, render, screen } from '@testing-library/react';
import { BuyerDialog } from '../components/BuyerDialog';

jest.mock('@mui/material/useMediaQuery', () => () => false);

describe('BuyerDialog (#83, AC-SL-001)', () => {
  it('tap cycles a size: preferred → also accepts → no', () => {
    const onSave = jest.fn();
    render(
      <BuyerDialog open saving={false} onSave={onSave} onClose={jest.fn()} />
    );
    fireEvent.change(screen.getByLabelText(/buyerDialog.name/), {
      target: { value: 'Lake View Restaurant' },
    });
    const sizeButtons = screen.getAllByRole('button', {
      name: 'buyerDialog.size',
    });
    expect(sizeButtons).toHaveLength(3);
    // MEDIUM → preferred; LARGE → preferred → acceptable
    fireEvent.click(sizeButtons[1]!);
    fireEvent.click(sizeButtons[2]!);
    fireEvent.click(sizeButtons[2]!);
    fireEvent.click(screen.getByRole('button', { name: 'buyerDialog.save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Lake View Restaurant',
        preferredSizes: ['MEDIUM'],
        acceptableSizes: ['LARGE'],
      })
    );
  });

  it('needs a name', () => {
    const onSave = jest.fn();
    render(
      <BuyerDialog open saving={false} onSave={onSave} onClose={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'buyerDialog.save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('buyerDialog.needName')).toBeInTheDocument();
  });

  it('prefills an existing buyer', () => {
    const onSave = jest.fn();
    render(
      <BuyerDialog
        open
        buyer={{
          id: 'b',
          name: 'Corner store',
          preferredSizes: ['LARGE'],
          acceptableSizes: ['MEDIUM'],
          status: 'ACTIVE',
          version: 2,
        }}
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'buyerDialog.save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredSizes: ['LARGE'],
        acceptableSizes: ['MEDIUM'],
      })
    );
  });
});
