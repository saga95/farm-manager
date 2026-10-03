import { useTranslation } from 'react-i18next';
import { AppPage } from '@/components/AppPage';
import { FarmDashboard } from '@/features/analytics/components/FarmDashboard';

/** SCR-003 Farm dashboard. Quick actions are shown as tiles, so the FAB is hidden here. */
export default function HomePage() {
  const { t } = useTranslation(['dashboard', 'shell']);
  const farmName = t('shell:farmFallback');
  return (
    <AppPage
      title={t('dashboard:title')}
      farmName={farmName}
      showQuickActions={false}
    >
      <FarmDashboard farmName={farmName} />
    </AppPage>
  );
}
