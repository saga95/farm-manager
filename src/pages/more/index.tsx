import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import { useAuth } from '@/contexts/AuthContext';
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import GroupOutlined from '@mui/icons-material/GroupOutlined';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import { AppPage } from '@/components/AppPage';
import { SectionLinks } from '@/components/ui/SectionLinks/SectionLinks';

/** More tab: analytics, search, settings, members, export, account (SRS §20). */
export default function MorePage() {
  const { t } = useTranslation(['shell', 'auth']);
  const { logout } = useAuth();
  return (
    <AppPage title={t('nav.more')}>
      <SectionLinks
        label={t('nav.more')}
        links={[
          {
            href: '/analytics',
            label: t('more.analytics'),
            icon: <InsightsOutlined />,
          },
          {
            href: '/search',
            label: t('more.search'),
            icon: <SearchOutlined />,
          },
          {
            href: '/settings',
            label: t('more.settings'),
            icon: <SettingsOutlined />,
          },
          {
            href: '/settings/members',
            label: t('more.members'),
            icon: <GroupOutlined />,
          },
          {
            href: '/settings/export',
            label: t('more.export'),
            icon: <FileDownloadOutlined />,
          },
          {
            href: '/settings/account',
            label: t('more.account'),
            icon: <AccountCircleOutlined />,
          },
        ]}
      />
      <Button
        variant='outlined'
        color='inherit'
        startIcon={<LogoutOutlined aria-hidden />}
        onClick={() => void logout()}
        sx={{ mt: 3 }}
        fullWidth
      >
        {t('auth:signOut')}
      </Button>
    </AppPage>
  );
}
