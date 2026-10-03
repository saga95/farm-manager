/**
 * QuickActions: persistent floating action menu (SRS §16, §20).
 *
 * @tokens Position offsets from tokens.spacing; sits above the mobile bottom nav.
 * @accessibility MUI SpeedDial: button with aria-expanded, menu items with
 * persistent visible labels (not tooltip-only), Escape closes.
 */

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import { tokens } from '@/design-system';
import { QUICK_ACTION_ICONS } from './icons';
import { QUICK_ACTIONS } from './navigation';

/** Height of the mobile bottom navigation (MUI default, 56px). */
export const BOTTOM_NAV_HEIGHT = tokens.spacing[14];

export function QuickActions() {
  const { t } = useTranslation('shell');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <SpeedDial
      ariaLabel={t('quickActions.label')}
      icon={<SpeedDialIcon />}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      FabProps={{ 'aria-label': t('quickActions.open') }}
      sx={{
        position: 'fixed',
        right: tokens.spacing[4],
        bottom: {
          xs: `calc(${BOTTOM_NAV_HEIGHT} + ${tokens.spacing[4]} + env(safe-area-inset-bottom))`,
          md: tokens.spacing[6],
        },
        zIndex: tokens.zIndex.sticky,
      }}
    >
      {QUICK_ACTIONS.map(action => (
        <SpeedDialAction
          key={action.key}
          icon={QUICK_ACTION_ICONS[action.key]}
          tooltipTitle={t(action.labelKey)}
          tooltipOpen
          onClick={() => {
            setOpen(false);
            void router.push(action.href);
          }}
          sx={{
            '& .MuiSpeedDialAction-staticTooltipLabel': {
              whiteSpace: 'nowrap',
              fontWeight: tokens.typography.fontWeight.semibold,
            },
          }}
        />
      ))}
    </SpeedDial>
  );
}

export default QuickActions;
