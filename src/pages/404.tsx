import { useTranslation } from 'react-i18next';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import { StatusPage } from '@/components/ui/StatusPage/StatusPage';

export default function Custom404() {
  const { t } = useTranslation('shell');
  return (
    <StatusPage
      icon={<SearchOffOutlined fontSize='large' />}
      title={t('notFound.title')}
      message={t('notFound.body')}
      action={{ label: t('notFound.home'), href: '/' }}
    />
  );
}
