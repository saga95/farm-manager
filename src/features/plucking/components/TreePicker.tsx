/**
 * TreePicker: searchable multi-select of trees that preserves TAP ORDER
 * (PO decision: the plucker chooses ~10 trees first, in his own order).
 *
 * @accessibility Each tree is a checkbox with its code as label; the selected
 * count is announced politely; 48px targets.
 */

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { tokens } from '@/design-system';
import { filterTrees } from '@/features/coconut/treeFilters';
import type { Tree } from '@/lib/api';

export interface TreePickerProps {
  trees: readonly Tree[];
  /** Selected ids in tap order */
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  /** Trees that can't be picked (e.g. already in the round) */
  excludeIds?: readonly string[];
  labels: { search: string; selected: string; hint: string; list: string };
  /** Optional secondary text per tree (e.g. zone name) */
  describe?: (tree: Tree) => string | undefined;
}

export function TreePicker({
  trees,
  selected,
  onChange,
  excludeIds = [],
  labels,
  describe,
}: TreePickerProps) {
  const [search, setSearch] = useState('');
  const available = useMemo(
    () => trees.filter(t => !excludeIds.includes(t.id)),
    [trees, excludeIds]
  );
  const visible = useMemo(
    () => filterTrees(available, search, 'ALL'),
    [available, search]
  );
  const codeOf = useMemo(
    () => new Map(trees.map(t => [t.id, t.code])),
    [trees]
  );

  const toggle = (id: string) =>
    onChange(
      selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]
    );

  return (
    <Stack spacing={2}>
      <TextField
        type='search'
        label={labels.search}
        value={search}
        onChange={e => setSearch(e.target.value)}
        inputProps={{ autoCapitalize: 'characters' }}
        InputProps={{
          startAdornment: (
            <InputAdornment position='start'>
              <SearchOutlined aria-hidden />
            </InputAdornment>
          ),
        }}
      />
      <Box aria-live='polite'>
        <Typography variant='subtitle2'>{labels.selected}</Typography>
        {selected.length === 0 ? (
          <Typography variant='body2' color='text.secondary'>
            {labels.hint}
          </Typography>
        ) : (
          <Stack
            direction='row'
            spacing={1}
            useFlexGap
            flexWrap='wrap'
            sx={{ mt: 1 }}
          >
            {selected.map((id, i) => (
              <Chip
                key={id}
                label={`${i + 1}. ${codeOf.get(id) ?? '?'}`}
                onDelete={() => toggle(id)}
                color='primary'
              />
            ))}
          </Stack>
        )}
      </Box>
      <Card>
        <List
          aria-label={labels.list}
          disablePadding
          sx={{
            maxHeight: { xs: '50dvh', md: tokens.spacing[64] },
            overflow: 'auto',
          }}
        >
          {visible.map(tree => {
            const checked = selected.includes(tree.id);
            const labelId = `pick-${tree.id}`;
            return (
              <ListItem key={tree.id} disablePadding divider>
                <ListItemButton
                  onClick={() => toggle(tree.id)}
                  sx={{ borderRadius: 0 }}
                >
                  <ListItemIcon sx={{ minWidth: tokens.spacing[10] }}>
                    <Checkbox
                      edge='start'
                      checked={checked}
                      tabIndex={-1}
                      disableRipple
                      inputProps={{ 'aria-labelledby': labelId }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    id={labelId}
                    primary={
                      tree.displayLabel
                        ? `${tree.code} · ${tree.displayLabel}`
                        : tree.code
                    }
                    secondary={describe?.(tree)}
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                  {checked && (
                    <Chip size='small' label={selected.indexOf(tree.id) + 1} />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Card>
    </Stack>
  );
}

export default TreePicker;
