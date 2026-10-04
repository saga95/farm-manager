/**
 * PhotoStrip: an entity's photos as thumbnails, plus "Add photos" (#46–#49).
 * Queued uploads show first with their state (waiting / uploading / failed +
 * Retry). The record itself is already saved; photos never block it (§41.12).
 * Tapping a ready photo opens the full-screen PhotoViewer.
 *
 * Presentational: data and actions come in as props, so it is easy to test and
 * document. Use <EntityPhotos> to wire it to the API and upload queue.
 */

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddAPhotoOutlined from '@mui/icons-material/AddAPhotoOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { SummaryCard } from '@/components/ui/SummaryCard/SummaryCard';
import { tokens } from '@/design-system';
import { MEDIA_CONTENT_TYPES } from '@/domain/media';
import type { Media } from '@/lib/api';
import type { QueuedUpload } from '../uploadQueue';

export interface PhotoStripProps {
  /** Name of the record, for the list label ("Photos of C-012"). */
  name: string;
  photos: readonly Media[];
  queued: readonly QueuedUpload[];
  loading?: boolean;
  canUpload: boolean;
  onAdd: (files: File[]) => Promise<number>;
  onOpen: (index: number) => void;
  onRetry: (mediaId: string) => void;
  onRemoveQueued: (mediaId: string) => void;
}

const TILE = tokens.spacing[24];
const ACCEPT = Object.keys(MEDIA_CONTENT_TYPES).join(',');

const tileSx = {
  width: TILE,
  height: TILE,
  flex: '0 0 auto',
  borderRadius: tokens.radius.md,
  overflow: 'hidden',
  position: 'relative',
  bgcolor: 'action.hover',
  border: 1,
  borderColor: 'divider',
} as const;

function QueuedTile({
  entry,
  onRetry,
  onRemove,
}: {
  entry: QueuedUpload;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('media');
  const [preview, setPreview] = useState<string | null>(null);
  const source = entry.thumb ?? entry.file;

  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return undefined;
    const url = URL.createObjectURL(source);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  const failed = entry.state === 'FAILED';
  return (
    <Stack spacing={0.5} sx={{ width: TILE, flex: '0 0 auto' }} role='listitem'>
      <Box sx={tileSx}>
        {preview && (
          <Box
            component='img'
            src={preview}
            alt=''
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.6,
            }}
          />
        )}
        <Stack
          alignItems='center'
          justifyContent='center'
          sx={{
            position: 'absolute',
            inset: 0,
            color: failed ? 'error.main' : 'text.primary',
          }}
        >
          {failed ? (
            <ErrorOutlineOutlined aria-hidden />
          ) : (
            <CircularProgress size={tokens.spacing[6]} aria-hidden />
          )}
        </Stack>
      </Box>
      <Typography
        variant='caption'
        color={failed ? 'error' : 'text.secondary'}
        role='status'
      >
        {t(`queue.${entry.state}`)}
      </Typography>
      {failed && (
        <Stack direction='row' spacing={0.5}>
          <Button size='small' onClick={onRetry} sx={{ minWidth: 0, px: 1 }}>
            {t('queue.retry')}
          </Button>
          <Button
            size='small'
            color='inherit'
            onClick={onRemove}
            sx={{ minWidth: 0, px: 1 }}
          >
            {t('queue.remove')}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

export function PhotoStrip({
  name,
  photos,
  queued,
  loading = false,
  canUpload,
  onAdd,
  onOpen,
  onRetry,
  onRemoveQueued,
}: PhotoStripProps) {
  const { t } = useTranslation('media');
  const input = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState(0);
  const [added, setAdded] = useState(false);
  const ready = photos.filter(p => p.status === 'READY');

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setRejected(await onAdd(files));
    setAdded(true);
  };

  const empty = !loading && photos.length === 0 && queued.length === 0;

  return (
    <SummaryCard
      title={t('strip.title')}
      icon={<PhotoLibraryOutlined fontSize='small' />}
      tone='secondary'
    >
      <Stack spacing={1.5}>
        {rejected > 0 && (
          <Alert severity='warning' onClose={() => setRejected(0)}>
            {t('strip.rejected', { count: rejected })}
          </Alert>
        )}
        {added && queued.length > 0 && (
          <Typography variant='body2' color='text.secondary'>
            {t('queue.saved')}
          </Typography>
        )}
        {empty ? (
          <EmptyState message={t('strip.empty')} />
        ) : (
          <Stack
            direction='row'
            spacing={1}
            role='list'
            aria-label={t('strip.list', { name })}
            sx={{ overflowX: 'auto', pb: 1, alignItems: 'flex-start' }}
          >
            {queued.map(entry => (
              <QueuedTile
                key={entry.mediaId}
                entry={entry}
                onRetry={() => onRetry(entry.mediaId)}
                onRemove={() => onRemoveQueued(entry.mediaId)}
              />
            ))}
            {photos.map(photo => {
              const readyIndex = ready.indexOf(photo);
              return photo.status === 'READY' && photo.thumbUrl ? (
                <ButtonBase
                  key={photo.id}
                  role='listitem'
                  onClick={() => onOpen(readyIndex)}
                  aria-label={t('strip.open', {
                    index: readyIndex + 1,
                    total: ready.length,
                  })}
                  sx={{
                    ...tileSx,
                    '&:focus-visible': {
                      outline: 2,
                      outlineColor: 'primary.main',
                    },
                  }}
                >
                  <Box
                    component='img'
                    src={photo.thumbUrl}
                    alt=''
                    loading='lazy'
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </ButtonBase>
              ) : (
                <Stack
                  key={photo.id}
                  role='listitem'
                  alignItems='center'
                  justifyContent='center'
                  sx={tileSx}
                >
                  <Typography variant='caption' color='text.secondary'>
                    {t('strip.processing')}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        )}
        {canUpload && (
          <>
            <Box
              component='input'
              ref={input}
              type='file'
              accept={ACCEPT}
              multiple
              onChange={e => void pick(e as ChangeEvent<HTMLInputElement>)}
              sx={{ display: 'none' }}
              data-testid='photo-input'
            />
            <Button
              variant='outlined'
              startIcon={<AddAPhotoOutlined aria-hidden />}
              onClick={() => input.current?.click()}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('strip.add')}
            </Button>
          </>
        )}
      </Stack>
    </SummaryCard>
  );
}

export default PhotoStrip;
