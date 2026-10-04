/**
 * MovementList: a batch's stock movements, newest first (SCR-016). Each row
 * says what happened in words and the signed quantity per state, so it reads
 * without colour.
 */

import { useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import type { ProduceTxn } from '@/lib/api';

const INBOUND = new Set(['HARVEST_IN', 'ADJUSTMENT_IN']);

export function MovementList({
  transactions,
  label,
}: {
  transactions: readonly ProduceTxn[];
  label: string;
}) {
  const { t, i18n } = useTranslation('inventory');
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );
  const stateName = (s?: string | null) =>
    t(s === 'DEHUSKED' ? 'produce.dehusked' : 'produce.husked').toLowerCase();

  return (
    <List aria-label={label} disablePadding>
      {transactions.map((txn, i) => {
        const amount =
          txn.transactionType === 'PROCESSING'
            ? t('txn.moved', { count: txn.quantity })
            : t(INBOUND.has(txn.transactionType) ? 'txn.in' : 'txn.out', {
                count: txn.quantity,
                state: stateName(txn.state),
              });
        return (
          <ListItem
            key={txn.id}
            divider={i < transactions.length - 1}
            sx={{ alignItems: 'flex-start' }}
          >
            <ListItemText
              primary={t(`txn.${txn.transactionType}`, {
                defaultValue: txn.transactionType,
              })}
              secondary={[fmt(txn.transactionDate), txn.notes]
                .filter(Boolean)
                .join(' · ')}
            />
            <Typography
              sx={{
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                ml: 2,
              }}
            >
              {amount}
            </Typography>
          </ListItem>
        );
      })}
    </List>
  );
}

export default MovementList;
