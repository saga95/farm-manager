/**
 * BuyerDialog: add or edit a buyer with size preferences (#83, §13.2).
 * Each size cycles Preferred → Also accepts → No with one tap; the state is
 * spelled out in the button text (never colour alone).
 */

import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { FormDialog } from '@/components/ui/FormDialog/FormDialog';
import { CLASSIFIED_SIZES, type ClassifiedSize } from '@/domain/samples';
import type { Buyer, BuyerFields } from '@/lib/api';

type Choice = 'PREFERRED' | 'ACCEPTABLE' | 'NO';
const NEXT: Record<Choice, Choice> = {
  NO: 'PREFERRED',
  PREFERRED: 'ACCEPTABLE',
  ACCEPTABLE: 'NO',
};

export interface BuyerDialogProps {
  open: boolean;
  buyer?: Buyer | null | undefined;
  saving: boolean;
  error?: string | null | undefined;
  onSave: (fields: BuyerFields) => void;
  onClose: () => void;
}

export function BuyerDialog({
  open,
  buyer,
  saving,
  error,
  onSave,
  onClose,
}: BuyerDialogProps) {
  const { t } = useTranslation('sales');
  const { t: ts } = useTranslation('samples');
  const sizesId = useId();
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [requirementNote, setRequirementNote] = useState('');
  const [notes, setNotes] = useState('');
  const [choices, setChoices] = useState<Record<ClassifiedSize, Choice>>({
    SMALL: 'NO',
    MEDIUM: 'NO',
    LARGE: 'NO',
  });
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(buyer?.name ?? '');
    setContactName(buyer?.contactName ?? '');
    setPhone(buyer?.phone ?? '');
    setRequirementNote(buyer?.requirementNote ?? '');
    setNotes(buyer?.notes ?? '');
    const pick = (s: ClassifiedSize): Choice =>
      buyer?.preferredSizes.includes(s)
        ? 'PREFERRED'
        : buyer?.acceptableSizes.includes(s)
          ? 'ACCEPTABLE'
          : 'NO';
    setChoices({
      SMALL: pick('SMALL'),
      MEDIUM: pick('MEDIUM'),
      LARGE: pick('LARGE'),
    });
    setProblem(null);
  }, [open, buyer]);

  const submit = () => {
    if (name.trim() === '') {
      setProblem(t('buyerDialog.needName'));
      return;
    }
    setProblem(null);
    onSave({
      name: name.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      requirementNote: requirementNote.trim(),
      notes: notes.trim(),
      preferredSizes: CLASSIFIED_SIZES.filter(s => choices[s] === 'PREFERRED'),
      acceptableSizes: CLASSIFIED_SIZES.filter(
        s => choices[s] === 'ACCEPTABLE'
      ),
    });
  };

  return (
    <FormDialog
      open={open}
      title={
        buyer
          ? t('buyerDialog.editTitle', { name: buyer.name })
          : t('buyerDialog.addTitle')
      }
      submitLabel={t('buyerDialog.save')}
      submittingLabel={t('buyerDialog.saving')}
      cancelLabel={t('buyerDialog.cancel')}
      submitting={saving}
      error={error ?? problem}
      onClose={onClose}
      onSubmit={submit}
    >
      <TextField
        label={t('buyerDialog.name')}
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      <Stack spacing={1} role='group' aria-labelledby={sizesId}>
        <Typography id={sizesId} variant='subtitle2'>
          {t('buyerDialog.sizes')}
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          {t('buyerDialog.sizesHelp')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {CLASSIFIED_SIZES.map(s => {
            const choice = choices[s];
            return (
              <Button
                key={s}
                fullWidth
                variant={choice === 'PREFERRED' ? 'contained' : 'outlined'}
                color={choice === 'NO' ? 'inherit' : 'primary'}
                onClick={() => setChoices(c => ({ ...c, [s]: NEXT[c[s]] }))}
                sx={{
                  justifyContent: 'space-between',
                  borderStyle: choice === 'ACCEPTABLE' ? 'dashed' : 'solid',
                }}
              >
                {t('buyerDialog.size', {
                  size: ts(`sizes.${s}`),
                  choice: t(`buyerDialog.choice.${choice}`),
                })}
              </Button>
            );
          })}
        </Stack>
      </Stack>
      <TextField
        label={t('buyerDialog.requirementNote')}
        value={requirementNote}
        onChange={e => setRequirementNote(e.target.value)}
        helperText={t('buyerDialog.requirementHelp')}
        multiline
      />
      <TextField
        label={t('buyerDialog.contactName')}
        value={contactName}
        onChange={e => setContactName(e.target.value)}
      />
      <TextField
        label={t('buyerDialog.phone')}
        value={phone}
        onChange={e => setPhone(e.target.value)}
        inputMode='tel'
        type='tel'
      />
      <TextField
        label={t('buyerDialog.notes')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        multiline
      />
    </FormDialog>
  );
}

export default BuyerDialog;
