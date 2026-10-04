import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ParkOutlined from '@mui/icons-material/ParkOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { tokens } from '@/design-system';
import { DUE_BUCKETS } from '@/domain/prediction';
import { useDueTrees } from '@/features/coconut/hooks';
import { DueBucketChip } from '@/features/prediction/components/DueBucketChip';
import { useTenant } from '@/features/tenant';
import type { DueTree } from '@/lib/api';

/** SCR-013 Next plucking / due-soon planning (§10.2, §10.3, US-014). */
export default function PlanningPage() {
  const { t, i18n } = useTranslation('coconut');
  const router = useRouter();
  const due = useDueTrees();
  const { can } = useTenant();
  const [selected, setSelected] = useState<string[]>([]);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${iso}T00:00:00`));

  const groups = useMemo(() => {
    const byBucket = new Map<string, DueTree[]>();
    for (const row of due.data ?? [])
      byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row]);
    return DUE_BUCKETS.map(b => ({
      bucket: b,
      rows: byBucket.get(b) ?? [],
    })).filter(g => g.rows.length > 0);
  }, [due.data]);

  const toggle = (id: string) =>
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const describe = (row: DueTree) => {
    const parts = [
      row.lastHarvestDate
        ? t('planning.row', {
            last: fmt(row.lastHarvestDate),
            qty: row.lastQuantity ?? '—',
          })
        : t('planning.rowNever'),
    ];
    if (row.prediction?.estimateDate)
      parts.push(t('planning.due', { date: fmt(row.prediction.estimateDate) }));
    return parts.join(' · ');
  };

  return (
    <AppPage title={t('planning.title')} showQuickActions={false}>
      <Typography color='text.secondary' sx={{ mb: 2 }}>
        {t('planning.intro')}
      </Typography>

      {due.isLoading ? (
        <Skeleton variant='rounded' height={300} aria-hidden />
      ) : groups.length === 0 ? (
        <EmptyState
          size='page'
          icon={<ParkOutlined fontSize='large' />}
          message={t('planning.empty')}
        />
      ) : (
        <Stack spacing={3}>
          {groups.map(group => (
            <Box
              component='section'
              key={group.bucket}
              aria-labelledby={`bucket-${group.bucket}`}
            >
              <Stack
                direction='row'
                alignItems='center'
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Typography
                  id={`bucket-${group.bucket}`}
                  variant='h4'
                  component='h2'
                >
                  {t(`planning.buckets.${group.bucket}`)}
                </Typography>
                <Typography color='text.secondary'>
                  · {group.rows.length}
                </Typography>
              </Stack>
              <Card>
                <List disablePadding aria-labelledby={`bucket-${group.bucket}`}>
                  {group.rows.map((row, i) => {
                    const checked = selected.includes(row.tree.id);
                    const labelId = `plan-${row.tree.id}`;
                    return (
                      <ListItem
                        key={row.tree.id}
                        disablePadding
                        divider={i < group.rows.length - 1}
                      >
                        <ListItemButton
                          onClick={() => toggle(row.tree.id)}
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
                            primary={row.tree.code}
                            secondary={describe(row)}
                            primaryTypographyProps={{ fontWeight: 700 }}
                          />
                          <DueBucketChip bucket={row.bucket} />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Card>
            </Box>
          ))}
        </Stack>
      )}

      {can('round.record') && (
        <Paper
          elevation={0}
          sx={{
            position: 'sticky',
            bottom: {
              xs: `calc(${tokens.spacing[14]} + ${tokens.spacing[2]})`,
              md: tokens.spacing[4],
            },
            mt: 2,
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            zIndex: tokens.zIndex.raised,
          }}
        >
          <Button
            fullWidth
            size='large'
            variant='contained'
            disabled={selected.length === 0}
            onClick={() =>
              void router.push({
                pathname: '/coconut/rounds/new',
                query: { trees: selected.join(',') },
              })
            }
          >
            {t('planning.start', { count: selected.length })}
          </Button>
        </Paper>
      )}
    </AppPage>
  );
}
