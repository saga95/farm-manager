import { useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { EntityList } from '@/features/farm/components/EntityList';
import { InputItemDialog } from '@/features/inventory/components/InputItemDialog';
import {
  useInputActions,
  useInputItems,
} from '@/features/inventory/inputHooks';
import { todayIso } from '@/features/plucking/hooks';
import { useCurrentFarm } from '@/features/farm/hooks';
import { useTenant } from '@/features/tenant';

/** SCR-017 Farm inputs: supplies with quantity and a low-stock flag (#81). */
export default function InputsPage() {
  const { t } = useTranslation('inventory');
  const router = useRouter();
  const { can } = useTenant();
  const { farm } = useCurrentFarm();
  const [showArchived, setShowArchived] = useState(false);
  const items = useInputItems(showArchived);
  const { create } = useInputActions();
  const [adding, setAdding] = useState(false);
  const [itemId, setItemId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canManage = can('input.manage');
  const unit = (u: string) => t(`inputs.units.${u}`, { defaultValue: u });

  return (
    <AppPage
      title={t('inputs.title')}
      actions={
        canManage ? (
          <Button
            variant='contained'
            startIcon={<AddOutlined aria-hidden />}
            onClick={() => {
              setItemId(ulid()); // stable per dialog: a retried save replays
              setError(null);
              setAdding(true);
            }}
          >
            {t('inputs.add')}
          </Button>
        ) : undefined
      }
    >
      <Typography color='text.secondary' sx={{ mb: 1 }}>
        {t('inputs.intro')}
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
          />
        }
        label={t('inputs.showArchived')}
        sx={{ mb: 1 }}
      />
      {items.isLoading ? (
        <Skeleton variant='rounded' height={200} aria-hidden />
      ) : (
        <EntityList
          label={t('inputs.title')}
          rows={(items.data ?? []).map(i => ({
            id: i.id,
            primary: i.name,
            secondary: [
              t(`inputs.categories.${i.category}`, {
                defaultValue: i.category,
              }),
              t('inputs.quantity', {
                quantity: i.quantity,
                unit: unit(i.unit),
              }),
            ].join(' · '),
            // Text + icon, never colour alone (#81)
            badge:
              i.status === 'ARCHIVED'
                ? t('inputs.archived')
                : i.lowStock
                  ? t('inputs.lowStock')
                  : undefined,
            badgeTone:
              i.lowStock && i.status !== 'ARCHIVED'
                ? ('warning' as const)
                : undefined,
          }))}
          onSelect={id => void router.push(`/inventory/inputs/${id}`)}
          empty={
            <EmptyState
              size='page'
              icon={<ScienceOutlined fontSize='large' />}
              message={t('inputs.empty')}
            />
          }
        />
      )}
      <InputItemDialog
        open={adding}
        saving={create.isLoading}
        error={error}
        onClose={() => setAdding(false)}
        onSave={(fields, opening) =>
          void create
            .mutateAsync({
              ...fields,
              itemId,
              openingQuantity: opening,
              openingDate: todayIso(farm?.timezone),
            })
            .then(saved => {
              setAdding(false);
              void router.push(`/inventory/inputs/${saved.id}`);
            })
            .catch(() => setError(t('inputDialog.failed')))
        }
      />
    </AppPage>
  );
}
