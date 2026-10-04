/**
 * ActivityDialog: record maintenance on a cycle, bed or zone (#94, §41.4).
 * One tap picks the activity type (labelled chips). Fertiliser, treatment,
 * mulch and planting can take the material from farm-input stock, which then
 * goes down by the amount used; otherwise the material is free text.
 */

import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { FormDialog } from '@/components/ui/FormDialog/FormDialog';
import {
  ACTIVITY_TYPES,
  type ActivityType,
  INPUT_ACTIVITY_TYPES,
} from '@/domain/cycles';
import type { InputItem } from '@/lib/api';

export interface ActivityValues {
  activityType: ActivityType;
  activityDate: string;
  notes: string | null;
  quantity: number | null;
  unit: string | null;
  materialName: string | null;
  inputItemId: string | null;
}

export interface ActivityDialogProps {
  open: boolean;
  today: string;
  inputs: readonly InputItem[];
  saving: boolean;
  error?: string | null | undefined;
  onSave: (v: ActivityValues) => void;
  onClose: () => void;
}

export function ActivityDialog({
  open,
  today,
  inputs,
  saving,
  error,
  onSave,
  onClose,
}: ActivityDialogProps) {
  const { t } = useTranslation('growing');
  const { t: ti } = useTranslation('inventory');
  const typeId = useId();
  const [type, setType] = useState<ActivityType>('WATERING');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [inputItemId, setInputItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [material, setMaterial] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType('WATERING');
    setDate(today);
    setNotes('');
    setInputItemId('');
    setQuantity('');
    setUnit('');
    setMaterial('');
    setProblem(null);
  }, [open, today]);

  const usesInput = INPUT_ACTIVITY_TYPES.includes(type);
  const item = inputs.find(i => i.id === inputItemId);
  const unitName = (u: string) => ti(`inputs.units.${u}`, { defaultValue: u });

  const submit = () => {
    const q = quantity.trim() === '' ? null : Number(quantity);
    if (item) {
      if (!q || !(q > 0)) return setProblem(t('activityDialog.needQuantity'));
      if (q > item.quantity)
        return setProblem(
          t('activityDialog.tooMuch', {
            quantity: item.quantity,
            unit: unitName(item.unit),
          })
        );
    }
    setProblem(null);
    return onSave({
      activityType: type,
      activityDate: date,
      notes: notes.trim() || null,
      quantity: q != null && q > 0 ? q : null,
      unit: item ? null : unit.trim() || null,
      materialName: item ? null : material.trim() || null,
      inputItemId: usesInput && item ? item.id : null,
    });
  };

  return (
    <FormDialog
      open={open}
      title={t('activityDialog.title')}
      submitLabel={t('activityDialog.save')}
      submittingLabel={t('activityDialog.saving')}
      cancelLabel={t('activityDialog.cancel')}
      submitting={saving}
      error={error ?? problem}
      onClose={onClose}
      onSubmit={submit}
    >
      <Stack spacing={1} role='radiogroup' aria-labelledby={typeId}>
        <Typography id={typeId} variant='subtitle2'>
          {t('activityDialog.type')}
        </Typography>
        <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
          {ACTIVITY_TYPES.map(a => (
            <Chip
              key={a}
              role='radio'
              aria-checked={type === a}
              label={t(`activity.${a}`)}
              color={type === a ? 'primary' : 'default'}
              variant={type === a ? 'filled' : 'outlined'}
              onClick={() => setType(a)}
            />
          ))}
        </Stack>
      </Stack>
      <TextField
        label={t('activityDialog.date')}
        type='date'
        value={date}
        onChange={e => setDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ max: today }}
      />
      {usesInput && inputs.length > 0 && (
        <TextField
          select
          label={t('activityDialog.fromStock')}
          value={inputItemId}
          onChange={e => setInputItemId(e.target.value)}
          helperText={
            item
              ? t('activityDialog.inStock', {
                  quantity: item.quantity,
                  unit: unitName(item.unit),
                })
              : undefined
          }
        >
          <MenuItem value=''>{t('activityDialog.noInput')}</MenuItem>
          {inputs.map(i => (
            <MenuItem key={i.id} value={i.id}>
              {i.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {item ? (
        <TextField
          label={t('activityDialog.quantityOf', { unit: unitName(item.unit) })}
          value={quantity}
          onChange={e => setQuantity(e.target.value.replace(/[^\d.]/g, ''))}
          inputMode='decimal'
          required
        />
      ) : (
        <>
          {usesInput && (
            <TextField
              label={t('activityDialog.material')}
              value={material}
              onChange={e => setMaterial(e.target.value)}
              helperText={t('activityDialog.materialHelp')}
            />
          )}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '2fr 1fr' }}>
            <TextField
              label={t('activityDialog.quantity')}
              value={quantity}
              onChange={e => setQuantity(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode='decimal'
            />
            <TextField
              label={t('activityDialog.unit')}
              value={unit}
              onChange={e => setUnit(e.target.value)}
            />
          </Box>
        </>
      )}
      <TextField
        label={t('activityDialog.notes')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        multiline
      />
      <Typography variant='caption' color='text.secondary'>
        {t('activityDialog.photosHint')}
      </Typography>
    </FormDialog>
  );
}

export default ActivityDialog;
