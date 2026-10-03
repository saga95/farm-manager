import { useTranslation } from 'react-i18next';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import { AppPage } from '@/components/AppPage';
import { SectionLinks } from '@/components/ui/SectionLinks/SectionLinks';

/** Inventory tab hub: produce and farm inputs (SRS §20). */
export default function InventoryPage() {
  const { t } = useTranslation('shell');
  return (
    <AppPage title={t('nav.inventory')}>
      <SectionLinks
        label={t('nav.inventory')}
        links={[
          {
            href: '/inventory/produce',
            label: t('inventory.produce'),
            icon: <Inventory2Outlined />,
          },
          {
            href: '/inventory/inputs',
            label: t('inventory.inputs'),
            icon: <ScienceOutlined />,
          },
        ]}
      />
    </AppPage>
  );
}
