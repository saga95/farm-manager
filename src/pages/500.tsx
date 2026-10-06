import { useTranslation } from 'react-i18next';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import { StatusPage } from '@/components/ui/StatusPage/StatusPage';

export default function Custom500() {
  const { t } = useTranslation('shell');
  return (
    <StatusPage
      icon={<ErrorOutlineOutlined fontSize='large' />}
      title={t('serverError.title')}
      message={t('serverError.body')}
      action={{ label: t('serverError.home'), href: '/' }}
    />
  );
}
