/**
 * FormDialog: create/edit form in a dialog; full-screen on phones (SRS §25.1).
 *
 * @tokens spacing from design-system/tokens.ts (via MUI spacing)
 * @accessibility Dialog labelled by its title (aria-labelledby); errors use
 * role="alert"; Escape and Cancel close; submit is a real <form> submit.
 */

import { type FormEvent, type ReactNode, useId } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export interface FormDialogProps {
  open: boolean;
  title: string;
  submitLabel: string;
  submittingLabel: string;
  cancelLabel: string;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: () => void;
  /** Optional secondary action (e.g. Archive) shown at the start of the action bar */
  secondaryAction?: ReactNode;
  children: ReactNode;
}

export function FormDialog({
  open,
  title,
  submitLabel,
  submittingLabel,
  cancelLabel,
  submitting = false,
  error,
  onClose,
  onSubmit,
  secondaryAction,
  children,
}: FormDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth='sm'
      aria-labelledby={titleId}
      PaperProps={
        {
          component: 'form',
          onSubmit: handleSubmit,
          noValidate: true,
        } as object
      }
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity='error' role='alert' sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {children}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        {secondaryAction && (
          <Stack sx={{ mr: 'auto' }}>{secondaryAction}</Stack>
        )}
        <Button onClick={onClose} disabled={submitting}>
          {cancelLabel}
        </Button>
        <Button type='submit' variant='contained' disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default FormDialog;
