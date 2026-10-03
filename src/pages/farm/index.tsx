import { useTranslation } from 'react-i18next';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import CropFreeOutlined from '@mui/icons-material/CropFreeOutlined';
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined';
import GrassOutlined from '@mui/icons-material/GrassOutlined';
import ParkOutlined from '@mui/icons-material/ParkOutlined';
import { AppPage } from '@/components/AppPage';
import { SectionLinks } from '@/components/ui/SectionLinks/SectionLinks';

/** Farm tab hub: coconut, zones, growing spaces, production cycles (SRS §20). */
export default function FarmPage() {
  const { t } = useTranslation('shell');
  return (
    <AppPage title={t('nav.farm')}>
      <SectionLinks
        label={t('nav.farm')}
        links={[
          {
            href: '/coconut/trees',
            label: t('farm.coconut'),
            icon: <ParkOutlined />,
          },
          {
            href: '/coconut/rounds',
            label: t('farm.rounds'),
            icon: <EventRepeatOutlined />,
          },
          {
            href: '/farm/zones',
            label: t('farm.zones'),
            icon: <AccountTreeOutlined />,
          },
          {
            href: '/farm/spaces',
            label: t('farm.spaces'),
            icon: <CropFreeOutlined />,
          },
          {
            href: '/farm/cycles',
            label: t('farm.cycles'),
            icon: <GrassOutlined />,
          },
        ]}
      />
    </AppPage>
  );
}
