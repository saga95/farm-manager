import { useTranslation } from 'react-i18next';
import Chip, { type ChipProps } from '@mui/material/Chip';

const COLOR: Record<string, ChipProps['color']> = {
  PRODUCING: 'success',
  YOUNG: 'info',
  NON_PRODUCING: 'default',
  TEMPORARILY_INACTIVE: 'warning',
  DAMAGED: 'warning',
  REMOVED: 'default',
  DEAD: 'default',
  ARCHIVED: 'default',
};

/** Tree status as text + colour (never colour alone, SRS §25.5). */
export function TreeStatusChip({
  status,
  size = 'small',
}: {
  status: string;
  size?: ChipProps['size'];
}) {
  const { t } = useTranslation('coconut');
  return (
    <Chip
      size={size}
      variant='outlined'
      color={COLOR[status] ?? 'default'}
      label={t(`status.${status}`)}
    />
  );
}

export default TreeStatusChip;
