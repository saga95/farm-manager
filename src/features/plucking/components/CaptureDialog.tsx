/**
 * CaptureDialog: record one tree's coconut count, fast (SRS §8.3, PR-002).
 * Big numeric field (numeric keypad), Save & Next, Skip. Full-screen on phones.
 *
 * @accessibility Labelled dialog; the count field receives focus on open (via
 * ref, so screen readers announce the dialog title first); errors use role="alert".
 */

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { tokens } from '@/design-system';
import { isValidQuantity } from '@/domain/plucking';

export interface CaptureDialogProps {
  open: boolean;
  treeCode: string;
  initialQuantity?: number | null | undefined;
  initialApproximate?: boolean | undefined;
  saving: boolean;
  error?: string | null | undefined;
  /** True when other trees are still pending (shows "Save & Next") */
  hasNext: boolean;
  onSave: (quantity: number, approximate: boolean) => void;
  onSkip: () => void;
  onClose: () => void;
}

export function CaptureDialog({
  open,
  treeCode,
  initialQuantity,
  initialApproximate = false,
  saving,
  error,
  hasNext,
  onSave,
  onSkip,
  onClose,
}: CaptureDialogProps) {
  const { t } = useTranslation('plucking');
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [approximate, setApproximate] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setValue(initialQuantity != null ? String(initialQuantity) : '');
    setApproximate(initialApproximate);
    setInvalid(false);
    // Focus after the dialog's own focus trap settles
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, treeCode, initialQuantity, initialApproximate]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = value.trim() === '' ? NaN : Number(value);
    if (!isValidQuantity(n)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onSave(n, approximate);
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth='xs'
      aria-labelledby={titleId}
      PaperProps={
        { component: 'form', onSubmit: submit, noValidate: true } as object
      }
    >
      <DialogTitle id={titleId}>
        {t('capture.count', { code: treeCode })}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && (
            <Alert severity='error' role='alert'>
              {error}
            </Alert>
          )}
          <TextField
            inputRef={inputRef}
            label={t('capture.countLabel')}
            value={value}
            onChange={e => setValue(e.target.value.replace(/[^\d]/g, ''))}
            inputMode='numeric'
            inputProps={{
              pattern: '[0-9]*',
              maxLength: 3,
              'aria-describedby': invalid ? `${titleId}-err` : undefined,
            }}
            error={invalid}
            helperText={
              invalid ? (
                <span id={`${titleId}-err`}>{t('capture.invalid')}</span>
              ) : undefined
            }
            sx={{
              '& input': {
                fontSize: tokens.typography.fontSize['4xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                textAlign: 'center',
                py: 2,
              },
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={approximate}
                onChange={e => setApproximate(e.target.checked)}
              />
            }
            label={t('capture.approximate')}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button
          color='inherit'
          onClick={onSkip}
          disabled={saving}
          sx={{ mr: 'auto' }}
        >
          {t('capture.skip')}
        </Button>
        <Button
          type='submit'
          variant='contained'
          size='large'
          disabled={saving}
        >
          {saving
            ? t('capture.saving')
            : hasNext
              ? t('capture.saveNext')
              : t('capture.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CaptureDialog;
