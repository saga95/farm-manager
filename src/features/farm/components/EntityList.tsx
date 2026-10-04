/**
 * EntityList: tappable list of farm records (zones, spaces) in a card.
 * Rows are buttons only when the user may edit (otherwise plain list items).
 *
 * @accessibility Status is conveyed by a text chip, never by colour alone (SRS §25.5).
 */

import { Fragment, type ReactNode } from 'react';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';

export interface EntityRow {
  id: string;
  primary: string;
  secondary?: string | undefined;
  /** Status text chip (e.g. "Unused", "Archived") */
  badge?: string | undefined;
  /** "warning" adds an icon + warning colour; the text still carries the meaning */
  badgeTone?: 'default' | 'warning' | undefined;
}

export interface EntityListProps {
  label: string;
  rows: readonly EntityRow[];
  onSelect?: ((id: string) => void) | undefined;
  empty?: ReactNode;
}

export function EntityList({ label, rows, onSelect, empty }: EntityListProps) {
  // eslint-disable-next-line react/jsx-no-useless-fragment -- required for JSX return type
  if (rows.length === 0) return <>{empty}</>;
  return (
    <Card>
      <List aria-label={label} disablePadding>
        {rows.map((row, i) => {
          const content = (
            <Stack
              direction='row'
              spacing={1}
              alignItems='center'
              sx={{ width: '100%' }}
            >
              <ListItemText
                primary={row.primary}
                secondary={row.secondary}
                primaryTypographyProps={{ fontWeight: 600 }}
              />
              {row.badge && (
                <Chip
                  size='small'
                  label={row.badge}
                  variant='outlined'
                  {...(row.badgeTone === 'warning'
                    ? {
                        color: 'warning' as const,
                        icon: <WarningAmberOutlined aria-hidden />,
                      }
                    : {})}
                />
              )}
            </Stack>
          );
          return (
            <Fragment key={row.id}>
              {i > 0 && <Divider component='li' aria-hidden />}
              {onSelect ? (
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => onSelect(row.id)}
                    sx={{ borderRadius: 0, py: 1.5 }}
                  >
                    {content}
                  </ListItemButton>
                </ListItem>
              ) : (
                <ListItem sx={{ py: 1.5 }}>{content}</ListItem>
              )}
            </Fragment>
          );
        })}
      </List>
    </Card>
  );
}

export default EntityList;
