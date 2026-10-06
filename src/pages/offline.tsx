import { useTranslation } from 'react-i18next';
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined';
import { StatusPage } from '@/components/ui/StatusPage/StatusPage';

/** Shown by the service worker for pages not yet opened on this phone while offline. */
export default function OfflinePage() {
  const { t } = useTranslation('shell');
  return (
    <StatusPage
      icon={<CloudOffOutlined fontSize='large' />}
      title={t('offline.title')}
      message={t('offline.body')}
      action={{
        label: t('offline.retry'),
        onClick: () => window.location.reload(),
      }}
    />
  );
}
