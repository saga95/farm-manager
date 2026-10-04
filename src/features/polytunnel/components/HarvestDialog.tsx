/**
 * HarvestDialog: record a polytunnel harvest by weight or count (#95, SCR-026).
 * Each harvest goes straight into produce stock as its own batch, ready to
 * sell (AC-PT-004). Kg and g allow decimals (12.5 kg, AC-PT-003); pieces are
 * whole.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { FormDialog } from '@/components/ui/FormDialog/FormDialog';
import {
  HARVEST_UNITS,
  type HarvestUnit,
  isValidHarvestQuantity,
} from '@/domain/cycles';

export interface HarvestValues {
  harvestDate: string;
  quantity: number;
  unit: HarvestUnit;
  qualityNote: string | null;
  notes: string | null;
}

export interface HarvestDialogProps {
  open: boolean;
  cropName: string;
  today: string;
  /** Unit of the previous harvest, so repeat harvests need one tap less */
  defaultUnit?: HarvestUnit | undefined;
  saving: boolean;
  error?: string | null | undefined;
  onSave: (v: HarvestValues) => void;
  onClose: () => void;
}

export function HarvestDialog({
  open,
  cropName,
  today,
  defaultUnit = 'KG',
  saving,
  error,
  onSave,
  onClose,
}: HarvestDialogProps) {
  const { t } = useTranslation('growing');
  const { t: ti } = useTranslation('inventory');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<HarvestUnit>(defaultUnit);
  const [date, setDate] = useState(today);
  const [quality, setQuality] = useState('');
  const [notes, setNotes] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuantity('');
    setUnit(defaultUnit);
    setDate(today);
    setQuality('');
    setNotes('');
    setProblem(null);
  }, [open, today, defaultUnit]);

  const submit = () => {
    const n = Number(quantity);
    if (quantity.trim() === '' || !isValidHarvestQuantity(n, unit))
      return setProblem(t('harvestDialog.invalid'));
    setProblem(null);
    return onSave({
      harvestDate: date,
      quantity: n,
      unit,
      qualityNote: quality.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <FormDialog
      open={open}
      title={t('harvestDialog.title', { crop: cropName })}
      submitLabel={t('harvestDialog.save')}
      submittingLabel={t('harvestDialog.saving')}
      cancelLabel={t('harvestDialog.cancel')}
      submitting={saving}
      error={error ?? problem}
      onClose={onClose}
      onSubmit={submit}
    >
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '2fr 1fr' }}>
        <TextField
          label={t('harvestDialog.quantity')}
          value={quantity}
          onChange={e =>
            setQuantity(
              e.target.value.replace(unit === 'COUNT' ? /\D/g : /[^\d.]/g, '')
            )
          }
          inputMode={unit === 'COUNT' ? 'numeric' : 'decimal'}
          required
        />
        <TextField
          select
          label={t('harvestDialog.unit')}
          value={unit}
          onChange={e => setUnit(e.target.value as HarvestUnit)}
        >
          {HARVEST_UNITS.map(u => (
            <MenuItem key={u} value={u}>
              {ti(`units.${u}`)}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <TextField
        label={t('harvestDialog.date')}
        type='date'
        value={date}
        onChange={e => setDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ max: today }}
      />
      <TextField
        label={t('harvestDialog.quality')}
        value={quality}
        onChange={e => setQuality(e.target.value)}
        helperText={t('harvestDialog.qualityHelp')}
      />
      <TextField
        label={t('harvestDialog.notes')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        multiline
      />
      <Alert severity='info' variant='outlined'>
        {t('harvestDialog.toStock')}
      </Alert>
    </FormDialog>
  );
}

export default HarvestDialog;
