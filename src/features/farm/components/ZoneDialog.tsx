import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { FormDialog } from '@/components/ui/FormDialog/FormDialog';
import { AREA_UNITS, ZONE_TYPES } from '@/domain/farm';
import { ApiError, type Zone } from '@/lib/api';
import {
  type ZoneFormValues,
  emptyZoneForm,
  fieldErrors,
  zoneFormSchema,
  zoneToForm,
} from '../forms';
import { useSaveZone } from '../hooks';

export interface ZoneDialogProps {
  open: boolean;
  /** Edit this zone; omit to create */
  zone?: Zone | undefined;
  onClose: () => void;
}

export function ZoneDialog({ open, zone, onClose }: ZoneDialogProps) {
  const { t } = useTranslation('farm');
  const save = useSaveZone();
  const [values, setValues] = useState<ZoneFormValues>(emptyZoneForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [newId, setNewId] = useState(ulid);

  useEffect(() => {
    if (!open) return;
    setValues(zone ? zoneToForm(zone) : emptyZoneForm());
    setErrors({});
    setError(null);
    setNewId(ulid()); // fresh id per create attempt; reused on retry within it
  }, [open, zone]);

  const set = (k: keyof ZoneFormValues) => (e: { target: { value: string } }) =>
    setValues(v => ({ ...v, [k]: e.target.value }));

  const submit = async (extra?: { status: string }) => {
    setError(null);
    const parsed = zoneFormSchema({
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
        zone,
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

  return (
    <FormDialog
      open={open}
      title={zone ? t('zones.edit') : t('zones.add')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      cancelLabel={t('actions.cancel')}
      submitting={save.isLoading}
      error={error}
      onClose={onClose}
      onSubmit={() => void submit()}
      secondaryAction={
        zone ? (
          <Button
            color='inherit'
            onClick={() =>
              void submit({
                status: zone.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED',
              })
            }
          >
            {zone.status === 'ARCHIVED'
              ? t('zones.restore')
              : t('zones.archive')}
          </Button>
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
        value={values.zoneType}
        onChange={set('zoneType')}
      >
        {ZONE_TYPES.map(z => (
          <MenuItem key={z} value={z}>
            {t(`zones.types.${z}`)}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction='row' spacing={2}>
        <TextField
          label={t('fields.area')}
          value={values.area}
          onChange={set('area')}
          inputMode='decimal'
          error={Boolean(errors['area'])}
          helperText={errors['area']}
        />
        <TextField
          select
          label={t('fields.areaUnit')}
          value={values.areaUnit}
          onChange={set('areaUnit')}
        >
          {AREA_UNITS.map(u => (
            <MenuItem key={u} value={u}>
              {t(`options.${u}`)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <TextField
        label={t('fields.description')}
        value={values.description}
        onChange={set('description')}
        multiline
        minRows={2}
      />
    </FormDialog>
  );
}

export default ZoneDialog;
