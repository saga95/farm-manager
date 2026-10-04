import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AppPage } from '@/components/AppPage';
import { FarmDashboard } from '@/features/analytics/components/FarmDashboard';
import { useDueTrees, useTrees } from '@/features/coconut/hooks';
import { useCurrentFarm } from '@/features/farm/hooks';
import { useTenant } from '@/features/tenant';
import { listProduceBatches } from '@/lib/api';

/** Loads live figures; rendered inside AppPage so it only runs for signed-in members. */
function LiveDashboard({ farmName }: { farmName: string }) {
  const { tenantId, farm } = useCurrentFarm();
  const trees = useTrees();
  const due = useDueTrees();
  const batches = useQuery({
    queryKey: ['batches', tenantId, farm?.id],
    queryFn: () => listProduceBatches(tenantId, farm?.id as string),
    enabled: Boolean(tenantId && farm?.id),
  });

  const coconut = trees.data
    ? {
        registered: trees.data.length,
        producing: trees.data.filter(t => t.status === 'PRODUCING').length,
      }
    : undefined;
  const nextPlucking = due.data
    ? {
        overdue: due.data.filter(d => d.bucket === 'OVERDUE').length,
        dueSoon: due.data.filter(d => d.bucket === 'DUE_SOON').length,
        noHistory: due.data.filter(d => d.bucket === 'NOT_ENOUGH_HISTORY')
          .length,
      }
    : undefined;
  const produce = batches.data
    ? {
        coconutsAvailable: batches.data
          .filter(b => b.cropCode === 'COCONUT')
          .reduce((sum, b) => sum + b.available, 0),
      }
    : undefined;

  return (
    <FarmDashboard
      farmName={farmName}
      coconut={coconut}
      nextPlucking={nextPlucking}
      produce={produce}
    />
  );
}

/** SCR-003 Farm dashboard. Quick actions are shown as tiles, so the FAB is hidden here. */
export default function HomePage() {
  const { t } = useTranslation(['dashboard', 'shell']);
  const { tenant } = useTenant();
  const farmName = tenant?.tenantName ?? t('shell:farmFallback');
  return (
    <AppPage
      title={t('dashboard:title')}
      farmName={farmName}
      showQuickActions={false}
    >
      <LiveDashboard farmName={farmName} />
    </AppPage>
  );
}
