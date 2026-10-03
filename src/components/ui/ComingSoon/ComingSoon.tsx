/**
 * ComingSoon: placeholder for planned screens (sitemap routes not built yet).
 * Temporary: each usage is replaced as its epic lands.
 *
 * @accessibility Uses EmptyState (heading + text + real link).
 */

import { useTranslation } from 'react-i18next';
import ConstructionOutlined from '@mui/icons-material/ConstructionOutlined';
import { EmptyState } from '../EmptyState/EmptyState';

export function ComingSoon() {
  const { t } = useTranslation('shell');
  return (
    <EmptyState
      size='page'
      icon={<ConstructionOutlined fontSize='large' />}
      title={t('comingSoon.title')}
      message={t('comingSoon.body')}
      action={{ label: t('comingSoon.backHome'), href: '/' }}
    />
  );
}

export default ComingSoon;
