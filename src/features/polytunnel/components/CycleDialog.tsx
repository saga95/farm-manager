/**
 * CycleDialog: start or edit a production cycle (#91, SCR-025). Grouped
 * management: the plant count is a number on the cycle, never plant records
 * (AC-PC-001). The cycle name defaults to "<Crop> <yyyy-mm>".
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { FormDialog } from '@/components/ui/FormDialog/FormDialog';
import { defaultCycleName } from '@/domain/cycles';
import { AREA_UNITS } from '@/domain/farm';
import type {
  CycleFields,
  GrowingSpace,
  ProductionCycle,
  Zone,
} from '@/lib/api';

export interface CycleDialogProps {
  open: boolean;
  cycle?: ProductionCycle | null | undefined;
  zones: readonly Zone[];
  spaces: readonly GrowingSpace[];
  today: string;
  saving: boolean;
  error?: string | null | undefined;
  onSave: (fields: CycleFields, startNow: boolean) => void;
  onClose: () => void;
}

const num = (v: string) => (v.trim() === '' ? null : Number(v));

export function CycleDialog({
  open,
  cycle,
  zones,
  spaces,
  today,
  saving,
  error,
  onSave,
  onClose,
}: CycleDialogProps) {
  const { t } = useTranslation('growing');
  const { t: tf } = useTranslation('farm');
  const [cropName, setCropName] = useState('');
  const [variety, setVariety] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [zoneId, setZoneId] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [plantedAt, setPlantedAt] = useState(today);
  const [expectedEndAt, setExpectedEndAt] = useState('');
  const [plants, setPlants] = useState('');
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState('SQ_M');
  const [notes, setNotes] = useState('');
  const [startNow, setStartNow] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const polytunnel = zones.find(z => z.zoneType === 'POLYTUNNEL');
    setCropName(cycle?.cropName ?? '');
    setVariety(cycle?.variety ?? '');
    setName(cycle?.name ?? '');
    setNameTouched(Boolean(cycle));
    setZoneId(cycle?.zoneId ?? polytunnel?.id ?? zones[0]?.id ?? '');
    setSpaceId(cycle?.growingSpaceId ?? '');
    setPlantedAt(cycle?.plantedAt ?? today);
    setExpectedEndAt(cycle?.expectedEndAt ?? '');
    setPlants(
      cycle?.estimatedPlantCount != null
        ? String(cycle.estimatedPlantCount)
        : ''
    );
    setArea(cycle?.areaUsed != null ? String(cycle.areaUsed) : '');
    setAreaUnit(cycle?.areaUnit ?? 'SQ_M');
    setNotes(cycle?.notes ?? '');
    setStartNow(true);
    setProblem(null);
  }, [open, cycle, zones, today]);

  const zoneSpaces = spaces.filter(
    s => !s.parentZoneId || s.parentZoneId === zoneId
  );
  const shownName = nameTouched
    ? name
    : cropName.trim()
      ? defaultCycleName(cropName, plantedAt || today)
      : '';

  const submit = () => {
    if (cropName.trim() === '') return setProblem(t('cycleDialog.needCrop'));
    if (!zoneId) return setProblem(t('cycleDialog.needZone'));
    setProblem(null);
    const areaUsed = num(area);
    return onSave(
      {
        name:
          shownName.trim() || defaultCycleName(cropName, plantedAt || today),
        cropName: cropName.trim(),
        variety: variety.trim() || null,
        zoneId,
        growingSpaceId: spaceId || null,
        plantedAt: plantedAt || null,
        expectedEndAt: expectedEndAt || null,
        estimatedPlantCount: num(plants),
        areaUsed,
        areaUnit: areaUsed != null ? areaUnit : null,
        notes: notes.trim() || null,
      },
      startNow
    );
  };

  return (
    <FormDialog
      open={open}
      title={
        cycle
          ? t('cycleDialog.editTitle', { name: cycle.name })
          : t('cycleDialog.addTitle')
      }
      submitLabel={t('cycleDialog.save')}
      submittingLabel={t('cycleDialog.saving')}
      cancelLabel={t('cycleDialog.cancel')}
      submitting={saving}
      error={error ?? problem}
      onClose={onClose}
      onSubmit={submit}
    >
      <TextField
        label={t('cycleDialog.crop')}
        value={cropName}
        onChange={e => setCropName(e.target.value)}
        helperText={t('cycleDialog.cropHelp')}
        required
      />
      <TextField
        label={t('cycleDialog.variety')}
        value={variety}
        onChange={e => setVariety(e.target.value)}
      />
      <TextField
        label={t('cycleDialog.name')}
        value={shownName}
        onChange={e => {
          setNameTouched(true);
          setName(e.target.value);
        }}
      />
      <TextField
        select
        label={t('cycleDialog.zone')}
        value={zoneId}
        onChange={e => {
          setZoneId(e.target.value);
          setSpaceId('');
        }}
        required
      >
        {zones.map(z => (
          <MenuItem key={z.id} value={z.id}>
            {z.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label={t('cycleDialog.space')}
        value={spaceId}
        onChange={e => setSpaceId(e.target.value)}
      >
        <MenuItem value=''>{t('cycleDialog.noSpace')}</MenuItem>
        {zoneSpaces.map(s => (
          <MenuItem key={s.id} value={s.id}>
            {s.name}
          </MenuItem>
        ))}
      </TextField>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        }}
      >
        <TextField
          label={t('cycleDialog.plantedAt')}
          type='date'
          value={plantedAt}
          onChange={e => setPlantedAt(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label={t('cycleDialog.expectedEndAt')}
          type='date'
          value={expectedEndAt}
          onChange={e => setExpectedEndAt(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      <TextField
        label={t('cycleDialog.plants')}
        value={plants}
        onChange={e => setPlants(e.target.value.replace(/\D/g, ''))}
        inputMode='numeric'
      />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
        <TextField
          label={t('cycleDialog.area')}
          value={area}
          onChange={e => setArea(e.target.value.replace(/[^\d.]/g, ''))}
          inputMode='decimal'
        />
        <TextField
          select
          label={t('cycleDialog.areaUnit')}
          value={areaUnit}
          onChange={e => setAreaUnit(e.target.value)}
        >
          {AREA_UNITS.map(u => (
            <MenuItem key={u} value={u}>
              {tf(`options.${u}`)}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <TextField
        label={t('cycleDialog.notes')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        multiline
      />
      {!cycle && (
        <FormControlLabel
          control={
            <Switch
              checked={startNow}
              onChange={e => setStartNow(e.target.checked)}
            />
          }
          label={t('cycleDialog.startNow')}
        />
      )}
    </FormDialog>
  );
}

export default CycleDialog;
