import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ParkOutlined from '@mui/icons-material/ParkOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { tokens } from '@/design-system';
import { useTrees } from '@/features/coconut/hooks';
import { useCurrentFarm, useZones } from '@/features/farm/hooks';
import { TreePicker } from '@/features/plucking/components/TreePicker';
import { todayIso, useCreateRound } from '@/features/plucking/hooks';

/** SCR-008 New plucking round: select the visit's trees first (PO 2026-10-04). */
export default function NewRoundPage() {
  const { t } = useTranslation('plucking');
  const router = useRouter();
  const { farm } = useCurrentFarm();
  const trees = useTrees();
  const zones = useZones();
  const create = useCreateRound();
  const [roundId] = useState(ulid); // stable per visit: a retried start replays
  const [date, setDate] = useState(() => todayIso(farm?.timezone));
  const [plucker, setPlucker] = useState('');
  // Preselected from the planning view (?trees=id1,id2), order kept
  const [selected, setSelected] = useState<string[]>([]);
  const preselect =
    typeof router.query['trees'] === 'string' ? router.query['trees'] : '';
  useEffect(() => {
    if (!preselect || !trees.data) return;
    const valid = new Set(trees.data.map(tr => tr.id));
    setSelected(preselect.split(',').filter(id => valid.has(id)));
  }, [preselect, trees.data]);
  const [error, setError] = useState<string | null>(null);
  const zoneName = useMemo(
    () => new Map((zones.data ?? []).map(z => [z.id, z.name])),
    [zones.data]
  );

  const start = async () => {
    setError(null);
    if (selected.length === 0) return setError(t('new.needTrees'));
    try {
      await create.mutateAsync({
        roundId,
        roundDate: date,
        plannedTreeIds: selected,
        pluckerName: plucker.trim() || null,
      });
      await router.replace(`/coconut/rounds/${roundId}`);
    } catch {
      setError(t('new.failed'));
    }
    return undefined;
  };

  return (
    <AppPage title={t('new.title')} showQuickActions={false}>
      <Typography color='text.secondary' sx={{ mb: 2 }}>
        {t('new.intro')}
      </Typography>
      {error && (
        <Alert severity='error' role='alert' sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Stack direction='row' spacing={2} sx={{ mb: 2 }}>
        <TextField
          label={t('new.date')}
          type='date'
          value={date}
          onChange={e => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label={t('new.plucker')}
          value={plucker}
          onChange={e => setPlucker(e.target.value)}
        />
      </Stack>

      {trees.isLoading ? (
        <Skeleton variant='rounded' height={300} aria-hidden />
      ) : (trees.data ?? []).length === 0 ? (
        <EmptyState
          size='page'
          icon={<ParkOutlined fontSize='large' />}
          message={t('new.noTrees')}
          action={{
            label: t('new.registerTrees'),
            href: '/coconut/trees/bulk',
          }}
        />
      ) : (
        <TreePicker
          trees={trees.data ?? []}
          selected={selected}
          onChange={setSelected}
          describe={tree =>
            tree.zoneId ? zoneName.get(tree.zoneId) : undefined
          }
          labels={{
            search: t('new.search'),
            selected: t('new.selected', { count: selected.length }),
            hint: t('new.selectedHint'),
            list: t('new.title'),
          }}
        />
      )}

      {/* Sticky primary action within thumb reach (SRS §25.1) */}
      <Paper
        elevation={0}
        sx={{
          position: 'sticky',
          bottom: {
            xs: `calc(${tokens.spacing[14]} + ${tokens.spacing[2]})`,
            md: tokens.spacing[4],
          },
          mt: 2,
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          zIndex: tokens.zIndex.raised,
        }}
      >
        <Button
          fullWidth
          size='large'
          variant='contained'
          onClick={() => void start()}
          disabled={create.isLoading || selected.length === 0}
        >
          {create.isLoading
            ? t('new.starting')
            : `${t('new.start')} · ${t('new.selected', { count: selected.length })}`}
        </Button>
      </Paper>
    </AppPage>
  );
}
