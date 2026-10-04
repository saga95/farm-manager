import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ParkOutlined from '@mui/icons-material/ParkOutlined';
import PlaylistAddOutlined from '@mui/icons-material/PlaylistAddOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { AppPage } from '@/components/AppPage';
import { tokens } from '@/design-system';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { TreeDialog } from '@/features/coconut/components/TreeDialog';
import { useTrees } from '@/features/coconut/hooks';
import { countByStatus, filterTrees } from '@/features/coconut/treeFilters';
import { EntityList } from '@/features/farm/components/EntityList';
import { useZones } from '@/features/farm/hooks';
import { useTenant } from '@/features/tenant';
import { CLASSIFIED_SIZES, type ClassifiedSize } from '@/domain/samples';

/** SCR-005 Coconut tree list (FR-CN-009). */
export default function TreesPage() {
  const { t } = useTranslation('coconut');
  const { t: ts } = useTranslation('samples');
  const router = useRouter();
  const { can } = useTenant();
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const [size, setSize] = useState<ClassifiedSize | 'ANY'>('ANY');
  // Deep link from a buyer: /coconut/trees?size=MEDIUM (#84)
  const sizeParam = router.query['size'];
  useEffect(() => {
    if (
      typeof sizeParam === 'string' &&
      (CLASSIFIED_SIZES as readonly string[]).includes(sizeParam)
    )
      setSize(sizeParam as ClassifiedSize);
  }, [sizeParam]);
  const [adding, setAdding] = useState(false);
  const trees = useTrees(showInactive);
  const zones = useZones();
  const canManage = can('tree.manage');

  const all = useMemo(() => trees.data ?? [], [trees.data]);
  const counts = useMemo(() => countByStatus(all), [all]);
  const visible = useMemo(
    () => filterTrees(all, search, status, size),
    [all, search, status, size]
  );
  const zoneName = useMemo(
    () => new Map((zones.data ?? []).map(z => [z.id, z.name])),
    [zones.data]
  );

  return (
    <AppPage
      title={t('trees.title')}
      actions={
        canManage ? (
          <Stack direction='row' spacing={1}>
            <Button
              component={NextLink}
              href='/coconut/trees/bulk'
              variant='contained'
              startIcon={<PlaylistAddOutlined aria-hidden />}
            >
              {t('trees.bulk')}
            </Button>
            <Button
              variant='outlined'
              startIcon={<AddOutlined aria-hidden />}
              onClick={() => setAdding(true)}
            >
              {t('trees.add')}
            </Button>
          </Stack>
        ) : undefined
      }
    >
      <Stack spacing={2} sx={{ mb: 2 }}>
        <TextField
          type='search'
          label={t('trees.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <SearchOutlined aria-hidden />
              </InputAdornment>
            ),
          }}
          inputProps={{ autoCapitalize: 'characters' }}
        />
        <Stack
          direction='row'
          spacing={1}
          useFlexGap
          flexWrap='wrap'
          role='group'
          aria-label={t('tree.status')}
        >
          <Chip
            label={`${t('trees.filterAll')} · ${all.length}`}
            color={status === 'ALL' ? 'primary' : 'default'}
            variant={status === 'ALL' ? 'filled' : 'outlined'}
            onClick={() => setStatus('ALL')}
            aria-pressed={status === 'ALL'}
          />
          {Object.entries(counts).map(([s, n]) => (
            <Chip
              key={s}
              label={`${t(`status.${s}`)} · ${n}`}
              color={status === s ? 'primary' : 'default'}
              variant={status === s ? 'filled' : 'outlined'}
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
            />
          ))}
        </Stack>
        <TextField
          select
          label={ts('filter.label')}
          value={size}
          onChange={e => setSize(e.target.value as ClassifiedSize | 'ANY')}
          sx={{ maxWidth: { sm: tokens.sizes.cardNarrow } }}
        >
          <MenuItem value='ANY'>{ts('filter.any')}</MenuItem>
          {CLASSIFIED_SIZES.map(c => (
            <MenuItem key={c} value={c}>
              {ts(`sizes.${c}`)}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Switch
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
            />
          }
          label={t('trees.showInactive')}
        />
      </Stack>

      {trees.isLoading ? (
        <Skeleton variant='rounded' height={240} aria-hidden />
      ) : (
        <>
          {all.length > 0 && (
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{ mb: 1 }}
              aria-live='polite'
            >
              {t('trees.count', { count: visible.length })}
            </Typography>
          )}
          <EntityList
            label={t('trees.title')}
            rows={visible.map(tree => ({
              id: tree.id,
              primary: tree.displayLabel
                ? `${tree.code} · ${tree.displayLabel}`
                : tree.code,
              secondary:
                [
                  tree.zoneId ? zoneName.get(tree.zoneId) : null,
                  tree.latestSampleSize
                    ? ts('history.latest', {
                        size: ts(`sizes.${tree.latestSampleSize}`),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined,
              badge: t(`status.${tree.status}`),
            }))}
            onSelect={id => void router.push(`/coconut/trees/${id}`)}
            empty={
              <EmptyState
                size='page'
                icon={<ParkOutlined fontSize='large' />}
                message={
                  all.length === 0 ? t('trees.empty') : t('trees.noMatch')
                }
                {...(all.length === 0 && canManage
                  ? {
                      action: {
                        label: t('trees.bulk'),
                        href: '/coconut/trees/bulk',
                      },
                    }
                  : {})}
              />
            }
          />
        </>
      )}

      <TreeDialog
        open={adding}
        zones={zones.data ?? []}
        onClose={saved => {
          setAdding(false);
          if (saved) void router.push(`/coconut/trees/${saved.id}`);
        }}
      />
    </AppPage>
  );
}
