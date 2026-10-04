/**
 * CorrectHarvestDialog: fix a tree's count on a COMPLETED round, or remove the
 * record (#56, #57, SRS §31). The server books the difference to stock and
 * keeps the previous quantity + an audit entry; this dialog only collects the
 * new count and an optional reason. Removing asks for confirmation first.
 *
 * @accessibility Labelled dialog; numeric keypad; errors use role="alert".
 */

import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { tokens } from '@/design-system';
import { isValidQuantity } from '@/domain/plucking';

export interface CorrectHarvestDialogProps {
  open: boolean;
  treeCode: string;
  quantity: number;
  previousQuantity?: number | null | undefined;
  canEdit: boolean;
  canRemove: boolean;
  saving: boolean;
  error?: string | null | undefined;
  onSave: (quantity: number, reason: string | null) => void;
  onRemove: (reason: string | null) => void;
  onClose: () => void;
}

export function CorrectHarvestDialog({
  open,
  treeCode,
  quantity,
  previousQuantity,
  canEdit,
  canRemove,
  saving,
  error,
  onSave,
  onRemove,
  onClose,
}: CorrectHarvestDialogProps) {
  const { t } = useTranslation('plucking');
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(String(quantity));
    setReason('');
    setProblem(null);
    setConfirming(false);
  }, [open, quantity, treeCode]);

  const why = reason.trim() === '' ? null : reason.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (value.trim() === '' || !isValidQuantity(n)) {
      setProblem(t('correct.invalid'));
      return;
    }
    if (n === quantity) {
      setProblem(t('correct.noChange'));
      return;
    }
    setProblem(null);
    onSave(n, why);
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
        {t('correct.title', { code: treeCode })}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {(error || problem) && (
            <Alert severity='error' role='alert'>
              {error ?? problem}
            </Alert>
          )}
          <Typography variant='body2' color='text.secondary'>
            {t('correct.intro')}
          </Typography>
          <Typography>
            {t('correct.was', { count: quantity })}
            {previousQuantity != null && (
              <Typography
                component='span'
                variant='body2'
                color='text.secondary'
                sx={{ ml: 1 }}
              >
                ({t('correct.previous', { count: previousQuantity })})
              </Typography>
            )}
          </Typography>
          {canEdit && (
            <TextField
              label={t('correct.count')}
              value={value}
              onChange={e => setValue(e.target.value.replace(/\D/g, ''))}
              inputMode='numeric'
              inputProps={{
                pattern: '[0-9]*',
                style: {
                  fontSize: tokens.typography.fontSize['3xl'],
                  textAlign: 'center',
                },
              }}
            />
          )}
          <TextField
            label={t('correct.reason')}
            value={reason}
            onChange={e => setReason(e.target.value)}
            multiline
            minRows={1}
          />
          {canRemove &&
            (confirming ? (
              <Alert
                severity='warning'
                action={
                  <Stack direction='row' spacing={1}>
                    <Button
                      color='inherit'
                      size='small'
                      onClick={() => setConfirming(false)}
                      disabled={saving}
                    >
                      {t('correct.cancel')}
                    </Button>
                    <Button
                      color='error'
                      size='small'
                      variant='contained'
                      onClick={() => onRemove(why)}
                      disabled={saving}
                    >
                      {t('correct.removeYes')}
                    </Button>
                  </Stack>
                }
              >
                {t('correct.removeConfirm', { code: treeCode })}
              </Alert>
            ) : (
              <Button
                color='error'
                onClick={() => setConfirming(true)}
                sx={{ alignSelf: 'flex-start' }}
              >
                {t('correct.remove')}
              </Button>
            ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={saving}
          color='inherit'
          sx={{ mr: 'auto' }}
        >
          {t('correct.cancel')}
        </Button>
        {canEdit && (
          <Button
            type='submit'
            variant='contained'
            size='large'
            disabled={saving}
          >
            {saving ? t('correct.saving') : t('correct.save')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default CorrectHarvestDialog;
