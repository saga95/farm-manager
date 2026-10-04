import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import YardOutlined from '@mui/icons-material/YardOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { EntityList } from '@/features/farm/components/EntityList';
import { useCurrentFarm, useSpaces, useZones } from '@/features/farm/hooks';
import { todayIso } from '@/features/plucking/hooks';
import { CycleDialog } from '@/features/polytunnel/components/CycleDialog';
import { useCycleActions, useCycles } from '@/features/polytunnel/hooks';
import { useTenant } from '@/features/tenant';
import type { ProductionCycle } from '@/lib/api';

/** SCR-024 Crop cycles by zone: what's growing where (#93). */
export default function CyclesPage() {
  const { t } = useTranslation('growing');
  const router = useRouter();
  const { can } = useTenant();
  const { farm } = useCurrentFarm();
  const [showClosed, setShowClosed] = useState(false);
  const cycles = useCycles(showClosed);
  const zones = useZones();
  const spaces = useSpaces();
  const { create } = useCycleActions();
  const [adding, setAdding] = useState(false);
  const [cycleId, setCycleId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canManage = can('cycle.manage');
  const zoneList = zones.data ?? [];

  // Group by zone so the polytunnel's cycles sit together (SCR-024)
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; cycles: ProductionCycle[] }>();
    for (const c of cycles.data ?? []) {
      const g = map.get(c.zoneId) ?? {
        name: c.zoneName ?? t('cycles.noZone'),
        cycles: [],
      };
      g.cycles.push(c);
      map.set(c.zoneId, g);
    }
    return [...map.entries()].sort((a, b) =>
      a[1].name.localeCompare(b[1].name)
    );
  }, [cycles.data, t]);

  return (
    <AppPage
      title={t('cycles.title')}
      actions={
        canManage && zoneList.length > 0 ? (
          <Button
            variant='contained'
            startIcon={<AddOutlined aria-hidden />}
            onClick={() => {
              setCycleId(ulid()); // stable per dialog: a retried save replays
              setError(null);
              setAdding(true);
            }}
          >
            {t('cycles.add')}
          </Button>
        ) : undefined
      }
    >
      <Typography color='text.secondary' sx={{ mb: 1 }}>
        {t('cycles.intro')}
      </Typography>
      {!zones.isLoading && zoneList.length === 0 && (
        <Alert severity='info' sx={{ mb: 2 }}>
          {t('cycles.needZone')}
        </Alert>
      )}
      <FormControlLabel
        control={
          <Switch
            checked={showClosed}
            onChange={e => setShowClosed(e.target.checked)}
          />
        }
        label={t('cycles.showClosed')}
        sx={{ mb: 1 }}
      />
      {cycles.isLoading ? (
        <Skeleton variant='rounded' height={240} aria-hidden />
      ) : groups.length === 0 ? (
        <EmptyState
          size='page'
          icon={<YardOutlined fontSize='large' />}
          message={t('cycles.empty')}
        />
      ) : (
        <Stack spacing={2}>
          {groups.map(([zoneId, g]) => (
            <Stack
              key={zoneId}
              spacing={1}
              component='section'
              aria-labelledby={`zone-${zoneId}`}
            >
              <Typography id={`zone-${zoneId}`} variant='h3' component='h2'>
                {g.name}
              </Typography>
              <EntityList
                label={g.name}
                rows={g.cycles.map(c => ({
                  id: c.id,
                  primary: c.name,
                  secondary: t('cycles.summary', {
                    crop: [c.cropName, c.variety].filter(Boolean).join(' · '),
                    plants:
                      c.estimatedPlantCount != null
                        ? t('cycles.plants', { count: c.estimatedPlantCount })
                        : t('cycles.plantsUnknown'),
                  }),
                  badge: t(`status.${c.status}`),
                }))}
                onSelect={id => void router.push(`/farm/cycles/${id}`)}
              />
            </Stack>
          ))}
        </Stack>
      )}
      <CycleDialog
        open={adding}
        zones={zoneList}
        spaces={spaces.data ?? []}
        today={todayIso(farm?.timezone)}
        saving={create.isLoading}
        error={error}
        onClose={() => setAdding(false)}
        onSave={(fields, startNow) =>
          void create
            .mutateAsync({
              ...fields,
              cycleId,
              status: startNow ? 'ACTIVE' : 'PLANNED',
            })
            .then(c => {
              setAdding(false);
              void router.push(`/farm/cycles/${c.id}`);
            })
            .catch(() => setError(t('cycleDialog.failed')))
        }
      />
    </AppPage>
  );
}
