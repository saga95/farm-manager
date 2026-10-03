import { useTranslation } from 'react-i18next';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import PointOfSaleOutlined from '@mui/icons-material/PointOfSaleOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import { AppPage } from '@/components/AppPage';
import { SectionLinks } from '@/components/ui/SectionLinks/SectionLinks';

/** Sales tab hub: record sale, history, buyers (SRS §20). */
export default function SalesPage() {
  const { t } = useTranslation('shell');
  return (
    <AppPage title={t('nav.sales')}>
      <SectionLinks
        label={t('nav.sales')}
        links={[
          {
            href: '/sales/new',
            label: t('quickActions.recordSale'),
            icon: <PointOfSaleOutlined />,
          },
          {
            href: '/sales/history',
            label: t('sales.history'),
            icon: <ReceiptLongOutlined />,
          },
          {
            href: '/sales/buyers',
            label: t('sales.buyers'),
            icon: <GroupsOutlined />,
          },
        ]}
      />
    </AppPage>
  );
}
