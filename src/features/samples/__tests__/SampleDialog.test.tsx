import { fireEvent, render, screen } from '@testing-library/react';
import { SampleDialog } from '../components/SampleDialog';

jest.mock('@mui/material/useMediaQuery', () => () => false);

const setup = (props: Partial<Parameters<typeof SampleDialog>[0]> = {}) => {
  const onSave = jest.fn();
  render(
    <SampleDialog
      open
      treeCode='C-007'
      saving={false}
      hasNext
      onSave={onSave}
      onClose={() => undefined}
      {...props}
    />
  );
  return onSave;
};

describe('SampleDialog (SCR-012)', () => {
  it('one tap on a size then Save & next saves the size and optional weight', () => {
    const onSave = setup();
    fireEvent.click(screen.getByRole('button', { name: 'sizes.LARGE' }));
    fireEvent.change(screen.getByLabelText('dialog.weight'), {
      target: { value: '950' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'dialog.saveNext' }));
    expect(onSave).toHaveBeenCalledWith('LARGE', 950);
  });

  it('asks for a size instead of saving nothing', () => {
    const onSave = setup({ hasNext: false });
    fireEvent.click(screen.getByRole('button', { name: 'dialog.save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('dialog.pickSize');
  });

  it('prefills a correction and treats an empty weight as none', () => {
    const onSave = setup({ initialSize: 'MEDIUM' });
    expect(
      screen.getByRole('button', { name: 'sizes.MEDIUM' })
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'dialog.saveNext' }));
    expect(onSave).toHaveBeenCalledWith('MEDIUM', null);
  });
});
