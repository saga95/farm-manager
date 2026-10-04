import { fireEvent, render, screen } from '@testing-library/react';
import { CaptureDialog } from '../components/CaptureDialog';

jest.mock('@mui/material/useMediaQuery', () => () => false);

const setup = (props: Partial<Parameters<typeof CaptureDialog>[0]> = {}) => {
  const onSave = jest.fn();
  const onSkip = jest.fn();
  render(
    <CaptureDialog
      open
      treeCode='C-012'
      saving={false}
      hasNext
      onSave={onSave}
      onSkip={onSkip}
      onClose={jest.fn()}
      {...props}
    />
  );
  return { onSave, onSkip, input: screen.getByLabelText('capture.countLabel') };
};

describe('CaptureDialog (SCR-009)', () => {
  it('saves a whole-number count with Save & Next', () => {
    const { onSave, input } = setup();
    fireEvent.change(input, { target: { value: '13' } });
    fireEvent.click(screen.getByRole('button', { name: 'capture.saveNext' }));
    expect(onSave).toHaveBeenCalledWith(13, false);
  });

  it('keeps only digits (numeric keypad) and rejects an empty count', () => {
    const { onSave, input } = setup();
    fireEvent.change(input, { target: { value: '1a.5' } });
    expect(input).toHaveValue('15');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'capture.saveNext' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('capture.invalid')).toBeInTheDocument();
  });

  it('records a real zero (different from "not recorded")', () => {
    const { onSave, input } = setup();
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'capture.saveNext' }));
    expect(onSave).toHaveBeenCalledWith(0, false);
  });

  it('marks approximate counts and offers Skip', () => {
    const { onSave, onSkip, input } = setup({ hasNext: false });
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.click(screen.getByLabelText('capture.approximate'));
    fireEvent.click(screen.getByRole('button', { name: 'capture.save' }));
    expect(onSave).toHaveBeenCalledWith(20, true);
    fireEvent.click(screen.getByRole('button', { name: 'capture.skip' }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('prefills an existing count for corrections', () => {
    const { input } = setup({ initialQuantity: 18 });
    expect(input).toHaveValue('18');
  });
});
