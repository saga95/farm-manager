import { useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import AddOutlined from '@mui/icons-material/AddOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { BuyerDialog } from '@/features/buyers/components/BuyerDialog';
import { useBuyerActions, useBuyers } from '@/features/buyers/hooks';
import { EntityList } from '@/features/farm/components/EntityList';
import { useTenant } from '@/features/tenant';

/** SCR-019 Buyers with their size preferences (#84). */
export default function BuyersPage() {
  const { t } = useTranslation('sales');
  const { t: ts } = useTranslation('samples');
  const router = useRouter();
  const { can } = useTenant();
  const [showArchived, setShowArchived] = useState(false);
  const buyers = useBuyers(showArchived);
  const { create } = useBuyerActions();
  const [adding, setAdding] = useState(false);
  const [buyerId, setBuyerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canManage = can('buyer.manage');

  return (
    <AppPage
      title={t('buyers.title')}
      actions={
        canManage ? (
          <Button
            variant='contained'
            startIcon={<AddOutlined aria-hidden />}
            onClick={() => {
              setBuyerId(ulid()); // stable per dialog: a retried save replays
              setError(null);
              setAdding(true);
            }}
          >
            {t('buyers.add')}
          </Button>
        ) : undefined
      }
    >
      <FormControlLabel
        control={
          <Switch
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
          />
        }
        label={t('buyers.showArchived')}
        sx={{ mb: 1 }}
      />
      {buyers.isLoading ? (
        <Skeleton variant='rounded' height={200} aria-hidden />
      ) : (
        <EntityList
          label={t('buyers.title')}
          rows={(buyers.data ?? []).map(b => ({
            id: b.id,
            primary: b.name,
            secondary: b.preferredSizes.length
              ? t('buyers.prefers', {
                  sizes: b.preferredSizes.map(s => ts(`sizes.${s}`)).join(', '),
                })
              : t('buyers.noPreference'),
            badge: b.status === 'ARCHIVED' ? t('buyers.archived') : undefined,
          }))}
          onSelect={id => void router.push(`/sales/buyers/${id}`)}
          empty={
            <EmptyState
              size='page'
              icon={<GroupsOutlined fontSize='large' />}
              message={t('buyers.empty')}
            />
          }
        />
      )}
      <BuyerDialog
        open={adding}
        saving={create.isLoading}
        error={error}
        onClose={() => setAdding(false)}
        onSave={fields =>
          void create
            .mutateAsync({ buyerId, fields })
            .then(b => {
              setAdding(false);
              void router.push(`/sales/buyers/${b.id}`);
            })
            .catch(() => setError(t('buyerDialog.failed')))
        }
      />
    </AppPage>
  );
}
