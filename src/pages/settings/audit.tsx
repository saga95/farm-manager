import { useTranslation } from 'react-i18next';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { ChangeHistory } from '@/features/records/ChangeHistory';
import { useTenant } from '@/features/tenant';

/** The farm's change history (#105, §31). */
export default function AuditPage() {
  const { t } = useTranslation('records');
  const { can } = useTenant();
  return (
    <AppPage title={t('history.title')}>
      {!can('audit.view') ? (
        <EmptyState size='page' message={t('history.noAccess')} />
      ) : (
        <>
          <Typography color='text.secondary' sx={{ mb: 2 }}>
            {t('history.intro')}
          </Typography>
          <Card>
            <CardContent>
              <ChangeHistory pageSize={30} />
            </CardContent>
          </Card>
        </>
      )}
    </AppPage>
  );
}
