import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import { TreeDialog } from '@/features/coconut/components/TreeDialog';
import { TreeStatusChip } from '@/features/coconut/components/TreeStatusChip';
import { useTree } from '@/features/coconut/hooks';
import { useZones } from '@/features/farm/hooks';
import { useTenant } from '@/features/tenant';

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack component='div' spacing={0.25}>
      <Typography component='dt' variant='caption' color='text.secondary'>
        {label}
      </Typography>
      <Typography component='dd' sx={{ m: 0 }}>
        {value}
      </Typography>
    </Stack>
  );
}

/** SCR-007 Coconut tree profile (shell): identity, details, history placeholder (§7.2). */
export default function TreeProfilePage() {
  const { t } = useTranslation('coconut');
  const router = useRouter();
  const treeId =
    typeof router.query['treeId'] === 'string'
      ? router.query['treeId']
      : undefined;
  const tree = useTree(treeId);
  const zones = useZones(true);
  const { can } = useTenant();
  const [editing, setEditing] = useState(false);
  const { data } = tree;
  const zone = data?.zoneId
    ? zones.data?.find(z => z.id === data.zoneId)?.name
    : undefined;
  const notSet = t('tree.notSet');

  return (
    <AppPage
      title={data ? data.code : t('trees.title')}
      actions={
        data && can('tree.manage') ? (
          <Button
            variant='outlined'
            startIcon={<EditOutlined aria-hidden />}
            onClick={() => setEditing(true)}
          >
            {t('tree.edit')}
          </Button>
        ) : undefined
      }
    >
      <Button
        component={NextLink}
        href='/coconut/trees'
        startIcon={<ArrowBackOutlined aria-hidden />}
        sx={{ mb: 2 }}
      >
        {t('tree.back')}
      </Button>

      {tree.isLoading && (
        <Skeleton variant='rounded' height={200} aria-hidden />
      )}
      {tree.isError && <EmptyState size='page' message={t('tree.notFound')} />}

      {data && (
        <Stack spacing={2}>
          <Stack direction='row' spacing={1.5} alignItems='center'>
            <TreeStatusChip status={data.status} size='medium' />
            {data.displayLabel && (
              <Typography color='text.secondary'>
                {data.displayLabel}
              </Typography>
            )}
          </Stack>

          <Card>
            <CardContent>
              <Typography variant='h4' component='h2' sx={{ mb: 2 }}>
                {t('tree.details')}
              </Typography>
              <Stack
                component='dl'
                sx={{
                  m: 0,
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' },
                }}
              >
                <Detail label={t('tree.code')} value={data.code} />
                <Detail label={t('tree.zone')} value={zone ?? notSet} />
                <Detail
                  label={t('tree.variety')}
                  value={data.variety ?? notSet}
                />
                <Detail
                  label={t('tree.plantedAt')}
                  value={data.plantedAt ?? notSet}
                />
                <Detail
                  label={t('tree.locationNote')}
                  value={data.locationNote ?? notSet}
                />
              </Stack>
              {data.notes && (
                <Typography
                  sx={{ mt: 2, whiteSpace: 'pre-wrap' }}
                  color='text.secondary'
                >
                  {data.notes}
                </Typography>
              )}
            </CardContent>
          </Card>

          <SummaryCard
            title={t('tree.history')}
            icon={<HistoryOutlined fontSize='small' />}
          >
            {/* §7.2: "No history" must be distinguishable from "Recorded harvest = 0" */}
            <EmptyState message={t('tree.noHistory')} />
          </SummaryCard>
        </Stack>
      )}

      {data && (
        <TreeDialog
          open={editing}
          tree={data}
          zones={zones.data ?? []}
          onClose={() => setEditing(false)}
        />
      )}
    </AppPage>
  );
}
