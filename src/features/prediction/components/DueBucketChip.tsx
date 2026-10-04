import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import Chip, { type ChipProps } from '@mui/material/Chip';
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';

/** Status, not series: reserved status colours + icon + label (never colour alone). */
const STYLE: Record<
  string,
  { color: NonNullable<ChipProps['color']>; icon: ReactElement }
> = {
  OVERDUE: { color: 'error', icon: <WarningAmberOutlined aria-hidden /> },
  DUE_SOON: { color: 'warning', icon: <ScheduleOutlined aria-hidden /> },
  UPCOMING: {
    color: 'success',
    icon: <EventAvailableOutlined aria-hidden />,
  },
  NOT_ENOUGH_HISTORY: {
    color: 'default',
    icon: <HelpOutlineOutlined aria-hidden />,
  },
};

export function DueBucketChip({
  bucket,
  size = 'small',
}: {
  bucket: string;
  size?: ChipProps['size'];
}) {
  const { t } = useTranslation('coconut');
  const style = STYLE[bucket] ?? STYLE['NOT_ENOUGH_HISTORY']!;
  return (
    <Chip
      size={size}
      variant='outlined'
      color={style.color}
      icon={style.icon}
      label={t(`planning.buckets.${bucket}`)}
    />
  );
}

export default DueBucketChip;
