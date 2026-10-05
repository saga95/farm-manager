import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { AppPage } from '@/components/AppPage';
import { EntityList } from '@/features/farm/components/EntityList';
import { useBuyers } from '@/features/buyers/hooks';
import { useTrees } from '@/features/coconut/hooks';
import { useInputItems } from '@/features/inventory/inputHooks';
import { useProduceBatches } from '@/features/inventory/hooks';
import { useRounds } from '@/features/plucking/hooks';
import { useCycles } from '@/features/polytunnel/hooks';
import { useSales } from '@/features/sales/hooks';
import { type ResultKind, search } from '@/features/search/match';

const KINDS: readonly ResultKind[] = [
  'tree',
  'cycle',
  'buyer',
  'round',
  'sale',
  'input',
  'batch',
];
const QUICK = [
  ['producing', '/coconut/trees?status=PRODUCING'],
  ['due', '/coconut/planning'],
  ['small', '/coconut/trees?size=SMALL'],
  ['medium', '/coconut/trees?size=MEDIUM'],
  ['large', '/coconut/trees?size=LARGE'],
  ['history', '/coconut/planning#NOT_ENOUGH_HISTORY'],
] as const;
const NO_FILTERS = {};

/** SCR-029 Search & filter (#102, §19). */
export default function SearchPage() {
  const { t, i18n } = useTranslation('records');
  const router = useRouter();
  const [q, setQ] = useState(
    typeof router.query['q'] === 'string' ? router.query['q'] : ''
  );
  const trees = useTrees(true);
  const rounds = useRounds(false);
  const buyers = useBuyers(true);
  const sales = useSales(NO_FILTERS);
  const inputs = useInputItems(true);
  const batches = useProduceBatches(false);
  const cycles = useCycles(true);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`)
    );

  const results = useMemo(
    () =>
      search(
        q,
        {
          trees: trees.data ?? [],
          rounds: rounds.data ?? [],
          buyers: buyers.data ?? [],
          sales: (sales.data?.pages ?? []).flatMap(p => p.sales),
          inputs: inputs.data ?? [],
          batches: batches.data ?? [],
          cycles: cycles.data ?? [],
        },
        fmt
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fmt depends on language only
    [
      q,
      trees.data,
      rounds.data,
      buyers.data,
      sales.data,
      inputs.data,
      batches.data,
      cycles.data,
      i18n.language,
    ]
  );

  return (
    <AppPage title={t('search.title')}>
      <Stack spacing={2}>
        <TextField
          type='search'
          label={t('search.label')}
          helperText={t('search.help')}
          value={q}
          onChange={e => setQ(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <SearchOutlined aria-hidden />
              </InputAdornment>
            ),
          }}
        />
        {q.trim() === '' ? (
          <Stack spacing={1}>
            <Typography variant='subtitle2'>{t('search.quick')}</Typography>
            <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
              {QUICK.map(([key, href]) => (
                <Chip
                  key={key}
                  label={t(`search.filters.${key}`)}
                  component={NextLink}
                  href={href}
                  clickable
                  variant='outlined'
                />
              ))}
            </Stack>
          </Stack>
        ) : results.length === 0 ? (
          <Typography color='text.secondary' role='status'>
            {t('search.none', { q })}
          </Typography>
        ) : (
          KINDS.filter(k => results.some(r => r.kind === k)).map(k => (
            <Stack
              key={k}
              spacing={1}
              component='section'
              aria-labelledby={`r-${k}`}
            >
              <Typography id={`r-${k}`} variant='h3' component='h2'>
                {t(`search.kinds.${k}`)}
              </Typography>
              <EntityList
                label={t(`search.kinds.${k}`)}
                rows={results
                  .filter(r => r.kind === k)
                  .map(r => ({
                    id: r.href,
                    primary: r.title,
                    secondary: r.subtitle,
                  }))}
                onSelect={href => void router.push(href)}
              />
            </Stack>
          ))
        )}
      </Stack>
    </AppPage>
  );
}
