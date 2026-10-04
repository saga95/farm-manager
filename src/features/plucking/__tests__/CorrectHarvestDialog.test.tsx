import { fireEvent, render, screen } from '@testing-library/react';
import { CorrectHarvestDialog } from '../components/CorrectHarvestDialog';

jest.mock('@mui/material/useMediaQuery', () => () => false);

const setup = (
  props: Partial<Parameters<typeof CorrectHarvestDialog>[0]> = {}
) => {
  const onSave = jest.fn();
  const onRemove = jest.fn();
  render(
    <CorrectHarvestDialog
      open
      treeCode='C-001'
      quantity={20}
      canEdit
      canRemove
      saving={false}
      onSave={onSave}
      onRemove={onRemove}
      onClose={jest.fn()}
      {...props}
    />
  );
  return { onSave, onRemove };
};

describe('CorrectHarvestDialog (#56, #57)', () => {
  it('saves a new whole-number count with an optional reason', () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText('correct.count'), {
      target: { value: '25' },
    });
    fireEvent.change(screen.getByLabelText('correct.reason'), {
      target: { value: 'Miscounted' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'correct.save' }));
    expect(onSave).toHaveBeenCalledWith(25, 'Miscounted');
  });

  it('rejects an unchanged or invalid count', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'correct.save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('correct.noChange');
    fireEvent.change(screen.getByLabelText('correct.count'), {
      target: { value: '900' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'correct.save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('correct.invalid');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('asks before removing the record', () => {
    const { onRemove } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'correct.remove' }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'correct.removeYes' }));
    expect(onRemove).toHaveBeenCalledWith(null);
  });

  it('shows only what the user may do', () => {
    setup({ canEdit: false, canRemove: false });
    expect(screen.queryByLabelText('correct.count')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'correct.remove' })
    ).not.toBeInTheDocument();
  });
});
