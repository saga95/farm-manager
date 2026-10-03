/**
 * SectionLinks: list of destinations for a tab hub page (Farm, Inventory, Sales, More).
 *
 * @tokens spacing, radius from design-system/tokens.ts
 * @accessibility A <nav> landmark with a label; each row is a link with a
 * visible label and a 48px target. Icons are decorative.
 */

import { Fragment, type ReactNode } from 'react';
import NextLink from 'next/link';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { tokens } from '@/design-system';

export interface SectionLink {
  href: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface SectionLinksProps {
  /** Accessible name of the navigation landmark */
  label: string;
  links: readonly SectionLink[];
}

export function SectionLinks({ label, links }: SectionLinksProps) {
  return (
    <Card component='nav' aria-label={label}>
      <List disablePadding>
        {links.map((link, i) => (
          <Fragment key={link.href}>
            {i > 0 && <Divider component='li' aria-hidden />}
            <li>
              <ListItemButton
                component={NextLink}
                href={link.href}
                sx={{ borderRadius: 0, py: 1.5 }}
              >
                {link.icon && (
                  <ListItemIcon
                    aria-hidden
                    sx={{ minWidth: tokens.spacing[10], color: 'primary.main' }}
                  >
                    {link.icon}
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={link.label}
                  secondary={link.description}
                  primaryTypographyProps={{
                    fontWeight: tokens.typography.fontWeight.semibold,
                  }}
                />
                <ChevronRight aria-hidden sx={{ color: 'text.secondary' }} />
              </ListItemButton>
            </li>
          </Fragment>
        ))}
      </List>
    </Card>
  );
}

export default SectionLinks;
