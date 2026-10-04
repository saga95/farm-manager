/**
 * StockActionDialog: dehusk nuts (#78) or record use / damage / waste /
 * adjustment (#77) on one batch. Shows how many are available in the chosen
 * state and never lets the user ask for more (AC-IN-002); adjustments need a
 * reason (AC-IN-004). The parent keeps one operation id per open dialog, so
 * retries are idempotent on the server.
 *
 * @accessibility Labelled dialog; choices are labelled toggle groups (text,
 * not colour); errors use role="alert".
 */

import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  MOVEMENT_TYPES,
  type MovementType,
  reasonRequired,
} from '@/domain/inventory';
import type { ProduceState } from '@/lib/api';

export type StockAction = 'dehusk' | 'move';

export interface StockActionValues {
  transactionType: MovementType | 'PROCESSING';
  state: ProduceState;
  quantity: number;
  transactionDate: string;
  notes: string | null;
}

export interface StockActionDialogProps {
  open: boolean;
  action: StockAction;
  available: Record<ProduceState, number>;
  today: string;
  saving: boolean;
  error?: string | null | undefined;
  onSave: (values: StockActionValues) => void;
  onClose: () => void;
}

export function StockActionDialog({
  open,
  action,
  available,
  today,
  saving,
  error,
  onSave,
  onClose,
}: StockActionDialogProps) {
  const { t } = useTranslation('inventory');
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();
  const stateId = useId();
  const [type, setType] = useState<MovementType>('HOUSEHOLD_USE');
  const [state, setState] = useState<ProduceState>('HUSKED');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType('HOUSEHOLD_USE');
    setState('HUSKED');
    setQuantity('');
    setDate(today);
    setNotes('');
    setProblem(null);
  }, [open, action, today]);

  const dehusking = action === 'dehusk';
  const effectiveState: ProduceState = dehusking ? 'HUSKED' : state;
  const adding = !dehusking && type === 'ADJUSTMENT_IN';
  const max = adding ? 1_000_000 : available[effectiveState];
  const needsReason = !dehusking && reasonRequired(type);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(quantity);
    if (!Number.isInteger(n) || n < 1 || n > max) {
      setProblem(t('dialog.invalidQuantity', { max }));
      return;
    }
    const note = notes.trim() === '' ? null : notes.trim();
    if (needsReason && !note) {
      setProblem(t('dialog.needReason'));
      return;
    }
    setProblem(null);
    onSave({
      transactionType: dehusking ? 'PROCESSING' : type,
      state: effectiveState,
      quantity: n,
      transactionDate: date,
      notes: note,
    });
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
        {dehusking ? t('dialog.dehuskTitle') : t('dialog.moveTitle')}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {(error || problem) && (
            <Alert severity='error' role='alert'>
              {error ?? problem}
            </Alert>
          )}
          {dehusking ? (
            <Typography variant='body2' color='text.secondary'>
              {t('dialog.dehuskIntro')}
            </Typography>
          ) : (
            <>
              <TextField
                select
                label={t('dialog.type')}
                value={type}
                onChange={e => setType(e.target.value as MovementType)}
              >
                {MOVEMENT_TYPES.map(m => (
                  <MenuItem key={m} value={m}>
                    {t(`txn.${m}`)}
                  </MenuItem>
                ))}
              </TextField>
              <Stack spacing={1}>
                <Typography id={stateId} variant='subtitle2'>
                  {t('dialog.state')}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={state}
                  onChange={(_, v: ProduceState | null) => v && setState(v)}
                  aria-labelledby={stateId}
                >
                  <ToggleButton value='HUSKED'>
                    {t('produce.husked')}
                  </ToggleButton>
                  <ToggleButton value='DEHUSKED'>
                    {t('produce.dehusked')}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </>
          )}
          <TextField
            label={t('dialog.quantity')}
            value={quantity}
            onChange={e => setQuantity(e.target.value.replace(/\D/g, ''))}
            inputMode='numeric'
            inputProps={{ pattern: '[0-9]*' }}
            helperText={
              adding
                ? undefined
                : t('dialog.available', { count: available[effectiveState] })
            }
          />
          <TextField
            label={t('dialog.date')}
            type='date'
            value={date}
            onChange={e => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: today }}
          />
          <TextField
            label={needsReason ? t('dialog.reason') : t('dialog.notes')}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            required={needsReason}
            multiline
            minRows={1}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={saving}
          color='inherit'
          sx={{ mr: 'auto' }}
        >
          {t('dialog.cancel')}
        </Button>
        <Button
          type='submit'
          variant='contained'
          size='large'
          disabled={saving}
        >
          {saving ? t('dialog.saving') : t('dialog.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default StockActionDialog;
