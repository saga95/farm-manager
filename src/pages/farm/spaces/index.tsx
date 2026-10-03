import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CropFreeOutlined from '@mui/icons-material/CropFreeOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { EntityList } from '@/features/farm/components/EntityList';
import { SpaceDialog } from '@/features/farm/components/SpaceDialog';
import { useSpaces, useZones } from '@/features/farm/hooks';
import { useTenant } from '@/features/tenant';
import type { GrowingSpace } from '@/lib/api';

type Filter = 'all' | 'ACTIVE' | 'UNUSED';

/** Growing spaces (§41.2, AC-SP-001..004): which spaces exist, which are unused. */
export default function SpacesPage() {
  const { t, i18n } = useTranslation(['farm', 'shell']);
  const { can } = useTenant();
  const spaces = useSpaces();
  const zones = useZones();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<GrowingSpace | undefined>();
  const [open, setOpen] = useState(false);
  const canManage = can('space.manage');

  const zoneName = useMemo(
    () => new Map((zones.data ?? []).map(z => [z.id, z.name])),
    [zones.data]
  );
  const area = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
  });

  const rows = (spaces.data ?? [])
    .filter(s => filter === 'all' || s.status === filter)
    .map(s => {
      const parts = [t(`spaces.types.${s.spaceType}`)];
      const zone = s.parentZoneId ? zoneName.get(s.parentZoneId) : undefined;
      if (zone) parts.push(t('spaces.inZone', { zone }));
      if (s.calculatedAreaSqM)
        parts.push(
          t('spaces.area', { value: area.format(s.calculatedAreaSqM) })
        );
      return {
        id: s.id,
        primary: s.name,
        secondary: parts.join(' · '),
        badge: s.status === 'UNUSED' ? t('spaces.statuses.UNUSED') : undefined,
      };
    });

  return (
    <AppPage
      title={t('spaces.title')}
      actions={
        canManage ? (
          <Button
            variant='contained'
            startIcon={<AddOutlined aria-hidden />}
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            {t('spaces.add')}
          </Button>
        ) : undefined
      }
    >
      <Typography color='text.secondary' sx={{ mb: 2 }}>
        {t('spaces.intro')}
      </Typography>
      <ToggleButtonGroup
        exclusive
        size='small'
        value={filter}
        onChange={(_, v: Filter | null) => v && setFilter(v)}
        aria-label={t('spaces.title')}
        sx={{ mb: 2 }}
      >
        {(['all', 'ACTIVE', 'UNUSED'] as const).map(f => (
          <ToggleButton key={f} value={f} sx={{ px: 2 }}>
            {t(`spaces.filter.${f}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {spaces.isLoading ? (
        <Skeleton variant='rounded' height={160} />
      ) : (
        <EntityList
          label={t('spaces.title')}
          rows={rows}
          onSelect={
            canManage
              ? id => {
                  setEditing(spaces.data?.find(s => s.id === id));
                  setOpen(true);
                }
              : undefined
          }
          empty={
            <EmptyState
              size='page'
              icon={<CropFreeOutlined fontSize='large' />}
              message={
                filter === 'all' ? t('spaces.empty') : t('spaces.emptyFiltered')
              }
            />
          }
        />
      )}
      <SpaceDialog
        open={open}
        space={editing}
        zones={zones.data ?? []}
        onClose={() => setOpen(false)}
      />
    </AppPage>
  );
}
