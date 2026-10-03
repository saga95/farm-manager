import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { FormDialog } from '@/components/ui/FormDialog/FormDialog';
import { LENGTH_UNITS, SPACE_TYPES } from '@/domain/farm';
import { ApiError, type GrowingSpace, type Zone } from '@/lib/api';
import {
  SPACE_CONDITION_FIELDS,
  type SpaceFormValues,
  emptySpaceForm,
  fieldErrors,
  spaceFormSchema,
  spaceToForm,
} from '../forms';
import { useSaveSpace } from '../hooks';

export interface SpaceDialogProps {
  open: boolean;
  space?: GrowingSpace | undefined;
  zones: readonly Zone[];
  onClose: () => void;
}

export function SpaceDialog({ open, space, zones, onClose }: SpaceDialogProps) {
  const { t } = useTranslation('farm');
  const save = useSaveSpace();
  const [values, setValues] = useState<SpaceFormValues>(emptySpaceForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [newId, setNewId] = useState(ulid);

  useEffect(() => {
    if (!open) return;
    setValues(space ? spaceToForm(space) : emptySpaceForm());
    setErrors({});
    setError(null);
    setNewId(ulid());
  }, [open, space]);

  const set =
    (k: keyof SpaceFormValues) => (e: { target: { value: string } }) =>
      setValues(v => ({ ...v, [k]: e.target.value }));

  const submit = async (extra?: { status: string }) => {
    setError(null);
    const parsed = spaceFormSchema({
      required: t('errors.required'),
      positive: t('errors.positive'),
    }).safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync({
        space,
        input: { ...parsed.data, ...extra },
        newId,
      });
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'CONFLICT'
          ? t('errors.conflict')
          : t('errors.failed')
      );
    }
  };

  const number = (k: 'width' | 'length', label: string) => (
    <TextField
      label={label}
      value={values[k]}
      onChange={set(k)}
      inputMode='decimal'
      error={Boolean(errors[k])}
      helperText={errors[k]}
    />
  );

  return (
    <FormDialog
      open={open}
      title={space ? t('spaces.edit') : t('spaces.add')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      cancelLabel={t('actions.cancel')}
      submitting={save.isLoading}
      error={error}
      onClose={onClose}
      onSubmit={() => void submit()}
      secondaryAction={
        space && space.status !== 'ARCHIVED' ? (
          <Stack direction='row' spacing={1}>
            <Button
              color='inherit'
              onClick={() =>
                void submit({
                  status: space.status === 'UNUSED' ? 'ACTIVE' : 'UNUSED',
                })
              }
            >
              {space.status === 'UNUSED'
                ? t('spaces.markActive')
                : t('spaces.markUnused')}
            </Button>
            <Button
              color='inherit'
              onClick={() => void submit({ status: 'ARCHIVED' })}
            >
              {t('spaces.archive')}
            </Button>
          </Stack>
        ) : undefined
      }
    >
      <TextField
        label={t('fields.name')}
        value={values.name}
        onChange={set('name')}
        error={Boolean(errors['name'])}
        helperText={errors['name']}
        required
      />
      <TextField
        select
        label={t('fields.type')}
        value={values.spaceType}
        onChange={set('spaceType')}
      >
        {SPACE_TYPES.map(s => (
          <MenuItem key={s} value={s}>
            {t(`spaces.types.${s}`)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label={t('fields.zone')}
        value={values.parentZoneId}
        onChange={set('parentZoneId')}
      >
        <MenuItem value=''>{t('fields.noZone')}</MenuItem>
        {zones.map(z => (
          <MenuItem key={z.id} value={z.id}>
            {z.name}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction='row' spacing={2}>
        {number('width', t('fields.width'))}
        {number('length', t('fields.length'))}
        <TextField
          select
          label={t('fields.lengthUnit')}
          value={values.lengthUnit}
          onChange={set('lengthUnit')}
        >
          {LENGTH_UNITS.map(u => (
            <MenuItem key={u} value={u}>
              {t(`options.${u}`)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Typography variant='overline' component='h3' color='text.secondary'>
        {t('fields.siteConditions')}
      </Typography>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        useFlexGap
        flexWrap='wrap'
      >
        {SPACE_CONDITION_FIELDS.map(([field, options, label]) => (
          <TextField
            key={field}
            select
            label={t(`fields.${label}`)}
            value={values[field]}
            onChange={set(field)}
            sx={{ flex: { sm: '1 1 30%' } }}
          >
            <MenuItem value=''>{t('fields.notSet')}</MenuItem>
            {options.map(o => (
              <MenuItem key={o} value={o}>
                {t(`options.${o}`)}
              </MenuItem>
            ))}
          </TextField>
        ))}
      </Stack>

      <TextField
        label={t('fields.currentUse')}
        value={values.currentUse}
        onChange={set('currentUse')}
      />
      <TextField
        label={t('fields.notes')}
        value={values.notes}
        onChange={set('notes')}
        multiline
        minRows={2}
      />
    </FormDialog>
  );
}

export default SpaceDialog;
