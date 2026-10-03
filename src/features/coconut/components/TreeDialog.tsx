import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { FormDialog } from '@/components/ui/FormDialog/FormDialog';
import {
  TREE_STATUSES,
  isValidTreeCode,
  normalizeTreeCode,
} from '@/domain/coconut';
import { ApiError, type Tree, type Zone } from '@/lib/api';
import { useCreateTree, useUpdateTree } from '../hooks';

interface Values {
  code: string;
  status: string;
  displayLabel: string;
  zoneId: string;
  variety: string;
  plantedAt: string;
  locationNote: string;
  notes: string;
}

const empty = (): Values => ({
  code: '',
  status: 'PRODUCING',
  displayLabel: '',
  zoneId: '',
  variety: '',
  plantedAt: '',
  locationNote: '',
  notes: '',
});

const fromTree = (t: Tree): Values => ({
  code: t.code,
  status: t.status,
  displayLabel: t.displayLabel ?? '',
  zoneId: t.zoneId ?? '',
  variety: t.variety ?? '',
  plantedAt: t.plantedAt ?? '',
  locationNote: t.locationNote ?? '',
  notes: t.notes ?? '',
});

const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

export interface TreeDialogProps {
  open: boolean;
  tree?: Tree | undefined;
  zones: readonly Zone[];
  onClose: (saved?: Tree) => void;
}

/** FR-CN-002 add a missing tree; FR-CN-003/007/008 edit zone, notes, status. Code is immutable. */
export function TreeDialog({ open, tree, zones, onClose }: TreeDialogProps) {
  const { t } = useTranslation('coconut');
  const create = useCreateTree();
  const update = useUpdateTree();
  const [values, setValues] = useState<Values>(empty);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newId, setNewId] = useState(ulid);

  useEffect(() => {
    if (!open) return;
    setValues(tree ? fromTree(tree) : empty());
    setCodeError(null);
    setError(null);
    setNewId(ulid());
  }, [open, tree]);

  const set = (k: keyof Values) => (e: { target: { value: string } }) =>
    setValues(v => ({ ...v, [k]: e.target.value }));

  const submit = async () => {
    setError(null);
    const fields = {
      status: values.status,
      displayLabel: orNull(values.displayLabel),
      zoneId: orNull(values.zoneId),
      variety: orNull(values.variety),
      plantedAt: orNull(values.plantedAt),
      locationNote: orNull(values.locationNote),
      notes: orNull(values.notes),
    };
    try {
      if (tree) {
        onClose(await update.mutateAsync({ tree, changes: fields }));
        return;
      }
      const code = normalizeTreeCode(values.code);
      if (!code || !isValidTreeCode(code)) {
        setCodeError(code ? t('errors.code') : t('errors.required'));
        return;
      }
      setCodeError(null);
      onClose(
        await create.mutateAsync({ treeId: newId, input: { ...fields, code } })
      );
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CONFLICT') {
        setError(tree ? t('errors.conflict') : t('tree.duplicate'));
      } else {
        setError(t('errors.failed'));
      }
    }
  };

  return (
    <FormDialog
      open={open}
      title={tree ? t('tree.edit') : t('trees.add')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      cancelLabel={t('actions.cancel')}
      submitting={create.isLoading || update.isLoading}
      error={error}
      onClose={() => onClose()}
      onSubmit={() => void submit()}
    >
      <TextField
        label={t('tree.code')}
        value={values.code}
        onChange={set('code')}
        disabled={Boolean(tree)}
        error={Boolean(codeError)}
        helperText={codeError ?? t('tree.codeHelp')}
        inputProps={{ autoCapitalize: 'characters' }}
        required
      />
      <TextField
        select
        label={t('tree.status')}
        value={values.status}
        onChange={set('status')}
      >
        {TREE_STATUSES.map(s => (
          <MenuItem key={s} value={s}>
            {t(`status.${s}`)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label={t('tree.zone')}
        value={values.zoneId}
        onChange={set('zoneId')}
      >
        <MenuItem value=''>{t('bulk.noZone')}</MenuItem>
        {zones.map(z => (
          <MenuItem key={z.id} value={z.id}>
            {z.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label={t('tree.label')}
        value={values.displayLabel}
        onChange={set('displayLabel')}
      />
      <TextField
        label={t('tree.variety')}
        value={values.variety}
        onChange={set('variety')}
      />
      <TextField
        label={t('tree.plantedAt')}
        type='date'
        value={values.plantedAt}
        onChange={set('plantedAt')}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label={t('tree.locationNote')}
        value={values.locationNote}
        onChange={set('locationNote')}
      />
      <TextField
        label={t('tree.notes')}
        value={values.notes}
        onChange={set('notes')}
        multiline
        minRows={2}
      />
    </FormDialog>
  );
}

export default TreeDialog;
