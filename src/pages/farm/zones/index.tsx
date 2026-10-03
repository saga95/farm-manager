import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { EntityList } from '@/features/farm/components/EntityList';
import { ZoneDialog } from '@/features/farm/components/ZoneDialog';
import { useZones } from '@/features/farm/hooks';
import { useTenant } from '@/features/tenant';
import type { Zone } from '@/lib/api';

/** SCR-004 Zone list (US-002, AC-PT-001). */
export default function ZonesPage() {
  const { t } = useTranslation(['farm', 'shell']);
  const { can } = useTenant();
  const [showArchived, setShowArchived] = useState(false);
  const zones = useZones(showArchived);
  const [editing, setEditing] = useState<Zone | undefined>();
  const [open, setOpen] = useState(false);
  const canManage = can('zone.manage');

  const openNew = () => {
    setEditing(undefined);
    setOpen(true);
  };

  return (
    <AppPage
      title={t('zones.title')}
      actions={
        canManage ? (
          <Button
            variant='contained'
            startIcon={<AddOutlined aria-hidden />}
            onClick={openNew}
          >
            {t('zones.add')}
          </Button>
        ) : undefined
      }
    >
      <Typography color='text.secondary' sx={{ mb: 2 }}>
        {t('zones.intro')}
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
          />
        }
        label={t('zones.archived')}
        sx={{ mb: 1 }}
      />
      {zones.isLoading ? (
        <Skeleton variant='rounded' height={160} aria-hidden />
      ) : (
        <EntityList
          label={t('zones.title')}
          rows={(zones.data ?? []).map(z => ({
            id: z.id,
            primary: z.name,
            secondary: t(`zones.types.${z.zoneType}`),
            badge: z.status === 'ARCHIVED' ? t('zones.archived') : undefined,
          }))}
          onSelect={
            canManage
              ? id => {
                  setEditing(zones.data?.find(z => z.id === id));
                  setOpen(true);
                }
              : undefined
          }
          empty={
            <EmptyState
              size='page'
              icon={<AccountTreeOutlined fontSize='large' />}
              message={t('zones.empty')}
            />
          }
        />
      )}
      <ZoneDialog open={open} zone={editing} onClose={() => setOpen(false)} />
    </AppPage>
  );
}
