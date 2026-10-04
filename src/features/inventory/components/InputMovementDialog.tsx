/**
 * InputMovementDialog: stock in, use, or adjust a farm input (#80, SCR-018).
 * Use and "remove" adjustments can't exceed what's in stock; adjustments need
 * a reason. The parent keeps one operation id per open dialog (idempotent).
 */

import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { FormDialog } from '@/components/ui/FormDialog/FormDialog';
import type { InputTxnType } from '@/domain/inputs';
import type { InputItem } from '@/lib/api';

export interface InputMovementValues {
  transactionType: InputTxnType;
  quantity: number;
  decrease: boolean;
  transactionDate: string;
  reason: string | null;
  notes: string | null;
}

export interface InputMovementDialogProps {
  open: boolean;
  type: InputTxnType;
  item: InputItem;
  today: string;
  saving: boolean;
  error?: string | null | undefined;
  onSave: (v: InputMovementValues) => void;
  onClose: () => void;
}

export function InputMovementDialog({
  open,
  type,
  item,
  today,
  saving,
  error,
  onSave,
  onClose,
}: InputMovementDialogProps) {
  const { t } = useTranslation('inventory');
  const dirId = useId();
  const [quantity, setQuantity] = useState('');
  const [decrease, setDecrease] = useState(false);
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const unit = t(`inputs.units.${item.unit}`, { defaultValue: item.unit });

  useEffect(() => {
    if (!open) return;
    setQuantity('');
    setDecrease(false);
    setDate(today);
    setReason('');
    setProblem(null);
  }, [open, type, today]);

  const takesAway = type === 'STOCK_OUT' || (type === 'ADJUSTMENT' && decrease);
  const title =
    type === 'STOCK_IN'
      ? 'inputDialog.stockInTitle'
      : type === 'STOCK_OUT'
        ? 'inputDialog.useTitle'
        : 'inputDialog.adjustTitle';

  const submit = () => {
    const n = Number(quantity);
    if (!(n > 0)) {
      setProblem(t('inputDialog.invalidQuantity'));
      return;
    }
    if (takesAway && n > item.quantity) {
      setProblem(t('inputDialog.tooMuch', { quantity: item.quantity, unit }));
      return;
    }
    const why = reason.trim() === '' ? null : reason.trim();
    if (type === 'ADJUSTMENT' && !why) {
      setProblem(t('inputDialog.needReason'));
      return;
    }
    setProblem(null);
    onSave({
      transactionType: type,
      quantity: n,
      decrease: type === 'ADJUSTMENT' && decrease,
      transactionDate: date,
      reason: type === 'ADJUSTMENT' ? why : null,
      notes: type === 'ADJUSTMENT' ? null : why,
    });
  };

  return (
    <FormDialog
      open={open}
      title={t(title, { name: item.name })}
      submitLabel={t('inputDialog.save')}
      submittingLabel={t('inputDialog.saving')}
      cancelLabel={t('inputDialog.cancel')}
      submitting={saving}
      error={error ?? problem}
      onClose={onClose}
      onSubmit={submit}
    >
      {type === 'ADJUSTMENT' && (
        <Stack spacing={1}>
          <Typography id={dirId} variant='subtitle2'>
            {t('inputDialog.direction')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={decrease ? 'down' : 'up'}
            onChange={(_, v: string | null) => v && setDecrease(v === 'down')}
            aria-labelledby={dirId}
          >
            <ToggleButton value='up'>{t('inputDialog.increase')}</ToggleButton>
            <ToggleButton value='down'>
              {t('inputDialog.decrease')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      )}
      <TextField
        label={t('inputDialog.quantity', { unit })}
        value={quantity}
        onChange={e => setQuantity(e.target.value.replace(/[^\d.]/g, ''))}
        inputMode='decimal'
        helperText={t('inputDialog.available', {
          quantity: item.quantity,
          unit,
        })}
      />
      <TextField
        label={t('inputDialog.date')}
        type='date'
        value={date}
        onChange={e => setDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ max: today }}
      />
      <TextField
        label={
          type === 'ADJUSTMENT'
            ? t('inputDialog.reason')
            : t('inputDialog.notes')
        }
        value={reason}
        onChange={e => setReason(e.target.value)}
        required={type === 'ADJUSTMENT'}
        multiline
      />
    </FormDialog>
  );
}

export default InputMovementDialog;
