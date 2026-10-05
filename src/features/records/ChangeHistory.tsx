/**
 * Change history (#105, §31, DQ-007): who changed what and when.
 * `ChangeList` is presentational; `ChangeHistory` loads one record's history
 * (or the whole farm's when no entityId) page by page.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { type AuditEntry, listAudit } from '@/lib/api';
import { useTenant } from '@/features/tenant';

const scalar = (v: unknown) =>
  v === null || v === undefined
    ? '—'
    : typeof v === 'object'
      ? JSON.stringify(v)
      : String(v);

/** "quantity: 20 → 22" lines from {before, after}; plus a reason when given. */
export function changeLines(
  details: Record<string, unknown>
): { field: string; before: string; after: string }[] {
  const before = (details['before'] ?? {}) as Record<string, unknown> | null;
  const after = (details['after'] ?? {}) as Record<string, unknown> | null;
  if (!after || typeof after !== 'object') return [];
  return Object.keys(after)
    .filter(k => JSON.stringify(before?.[k]) !== JSON.stringify(after[k]))
    .map(k => ({
      field: k,
      before: scalar(before?.[k]),
      after: scalar(after[k]),
    }));
}

export function ChangeList({ entries }: { entries: readonly AuditEntry[] }) {
  const { t, i18n } = useTranslation('records');
  const when = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  if (entries.length === 0)
    return <Typography color='text.secondary'>{t('history.empty')}</Typography>;
  return (
    <List disablePadding aria-label={t('history.section')}>
      {entries.map((e, i) => {
        const changes = changeLines(e.details);
        const reason =
          typeof e.details['reason'] === 'string'
            ? (e.details['reason'] as string)
            : null;
        return (
          <ListItem
            key={e.id}
            divider={i < entries.length - 1}
            disableGutters
            sx={{ alignItems: 'flex-start' }}
          >
            <ListItemText
              primary={t(`action.${e.action}`, { defaultValue: e.action })}
              secondary={
                <>
                  {t('history.by', {
                    who: e.actorEmail ?? t('history.someone'),
                    when: when(e.at),
                  })}
                  {changes.map(c => (
                    <Typography
                      key={c.field}
                      component='span'
                      variant='body2'
                      sx={{ display: 'block' }}
                    >
                      {t('history.change', c)}
                    </Typography>
                  ))}
                  {reason && (
                    <Typography
                      component='span'
                      variant='body2'
                      sx={{ display: 'block' }}
                    >
                      {t('history.reason', { reason })}
                    </Typography>
                  )}
                </>
              }
              secondaryTypographyProps={{ component: 'div' }}
            />
          </ListItem>
        );
      })}
    </List>
  );
}

export function ChangeHistory({
  entityId,
  pageSize = 20,
}: {
  entityId?: string;
  pageSize?: number;
}) {
  const { t } = useTranslation('records');
  const { tenant, can } = useTenant();
  const tenantId = tenant?.tenantId ?? '';
  const q = useInfiniteQuery({
    queryKey: ['audit', tenantId, entityId ?? 'all'],
    queryFn: ({ pageParam }: { pageParam?: string | null }) =>
      listAudit(tenantId, {
        entityId: entityId ?? null,
        nextToken: pageParam ?? null,
        limit: pageSize,
      }),
    getNextPageParam: last => last.nextToken ?? undefined,
    enabled: Boolean(tenantId) && can('audit.view'),
  });
  if (!can('audit.view')) return null;
  if (q.isLoading)
    return <Skeleton variant='rounded' height={120} aria-hidden />;
  if (q.isError)
    return <Typography color='error'>{t('history.failed')}</Typography>;
  const entries = (q.data?.pages ?? []).flatMap(p => p.entries);
  return (
    <>
      <ChangeList entries={entries} />
      {q.hasNextPage && (
        <Button
          onClick={() => void q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
          sx={{ mt: 1 }}
        >
          {t('history.loadMore')}
        </Button>
      )}
    </>
  );
}

export default ChangeHistory;
