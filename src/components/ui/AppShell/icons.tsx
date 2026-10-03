import type { ReactElement } from 'react';
import AgricultureOutlined from '@mui/icons-material/AgricultureOutlined';
import GrassOutlined from '@mui/icons-material/GrassOutlined';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import ParkOutlined from '@mui/icons-material/ParkOutlined';
import PointOfSaleOutlined from '@mui/icons-material/PointOfSaleOutlined';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import SwapVertOutlined from '@mui/icons-material/SwapVertOutlined';
import type { NavKey, QuickActionKey } from './navigation';

/** Decorative icons: every usage is paired with a visible or aria label. */
export const NAV_ICONS: Record<NavKey, ReactElement> = {
  home: <HomeOutlined aria-hidden />,
  farm: <AgricultureOutlined aria-hidden />,
  inventory: <Inventory2Outlined aria-hidden />,
  sales: <StorefrontOutlined aria-hidden />,
  more: <MoreHoriz aria-hidden />,
};

export const QUICK_ACTION_ICONS: Record<QuickActionKey, ReactElement> = {
  newRound: <ParkOutlined aria-hidden />,
  recordHarvest: <GrassOutlined aria-hidden />,
  recordSale: <PointOfSaleOutlined aria-hidden />,
  inventoryMovement: <SwapVertOutlined aria-hidden />,
};
