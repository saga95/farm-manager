/**
 * InputItemDialog: add or edit a farm-input item (#80, SCR-017). The unit is
 * fixed once created (history is in that unit). Opening stock becomes a
 * STOCK_IN movement on the server.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { FormDialog } from '@/components/ui/FormDialog/FormDialog';
import { INPUT_CATEGORIES, INPUT_UNITS } from '@/domain/inputs';
import type { InputItem, InputItemFields } from '@/lib/api';

export interface InputItemDialogProps {
  open: boolean;
  /** Present when editing */
  item?: InputItem | null | undefined;
  saving: boolean;
  error?: string | null | undefined;
  onSave: (fields: InputItemFields, openingQuantity: number | null) => void;
  onClose: () => void;
}

const num = (v: string) => (v.trim() === '' ? null : Number(v));

export function InputItemDialog({
  open,
  item,
  saving,
  error,
  onSave,
  onClose,
}: InputItemDialogProps) {
  const { t } = useTranslation('inventory');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('FERTILIZER');
  const [unit, setUnit] = useState<string>('KG');
  const [reorder, setReorder] = useState('');
  const [opening, setOpening] = useState('');
  const [notes, setNotes] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setCategory(item?.category ?? 'FERTILIZER');
    setUnit(item?.unit ?? 'KG');
    setReorder(item?.reorderLevel != null ? String(item.reorderLevel) : '');
    setOpening('');
    setNotes(item?.notes ?? '');
    setProblem(null);
  }, [open, item]);

  const submit = () => {
    if (name.trim() === '') {
      setProblem(t('inputDialog.needName'));
      return;
    }
    const level = num(reorder);
    const start = num(opening);
    if (
      (level !== null && !(level >= 0)) ||
      (start !== null && !(start >= 0))
    ) {
      setProblem(t('inputDialog.invalidQuantity'));
      return;
    }
    setProblem(null);
    onSave(
      {
        name: name.trim(),
        category,
        unit,
        reorderLevel: level,
        notes: notes.trim() === '' ? null : notes.trim(),
      },
      start
    );
  };

  const decimal = (v: string) => v.replace(/[^\d.]/g, '');

  return (
    <FormDialog
      open={open}
      title={
        item
          ? t('inputDialog.editTitle', { name: item.name })
          : t('inputDialog.addTitle')
      }
      submitLabel={t('inputDialog.save')}
      submittingLabel={t('inputDialog.saving')}
      cancelLabel={t('inputDialog.cancel')}
      submitting={saving}
      error={error ?? problem}
      onClose={onClose}
      onSubmit={submit}
    >
      <TextField
        label={t('inputDialog.name')}
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      <TextField
        select
        label={t('inputDialog.category')}
        value={category}
        onChange={e => setCategory(e.target.value)}
      >
        {INPUT_CATEGORIES.map(c => (
          <MenuItem key={c} value={c}>
            {t(`inputs.categories.${c}`)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label={t('inputDialog.unit')}
        value={unit}
        onChange={e => setUnit(e.target.value)}
        disabled={Boolean(item)}
        helperText={item ? t('inputDialog.unitFixed') : undefined}
      >
        {INPUT_UNITS.map(u => (
          <MenuItem key={u} value={u}>
            {t(`inputs.units.${u}`)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label={t('inputDialog.reorderLevel')}
        value={reorder}
        onChange={e => setReorder(decimal(e.target.value))}
        inputMode='decimal'
        helperText={t('inputDialog.reorderHelp')}
      />
      {!item && (
        <TextField
          label={t('inputDialog.opening')}
          value={opening}
          onChange={e => setOpening(decimal(e.target.value))}
          inputMode='decimal'
        />
      )}
      <TextField
        label={t('inputDialog.notes')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        multiline
      />
    </FormDialog>
  );
}

export default InputItemDialog;
