/**
 * PhotoViewer (SCR-028, #49): full-screen viewer for an entity's photos.
 * Swipe, arrow keys or the buttons move between photos; shows caption and the
 * capture date. The original loads on demand; the thumbnail shows meanwhile.
 *
 * @accessibility Dialog with a labelled title ("Photo 2 of 5"), labelled
 * previous/next buttons, ←/→ keys, and alt text from the caption or date.
 */

import { type TouchEvent, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { tokens } from '@/design-system';
import type { Media } from '@/lib/api';

export interface PhotoViewerProps {
  photos: readonly Media[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** Original-size URL for the current photo, when loaded. */
  originalUrl?: string | null | undefined;
  originalLoading?: boolean;
  originalFailed?: boolean;
  /** Present when the user may remove photos. */
  onArchive?: ((media: Media) => void) | undefined;
  archiving?: boolean;
}

const SWIPE_PX = 50;

export function PhotoViewer({
  photos,
  index,
  onIndexChange,
  originalUrl,
  originalLoading = false,
  originalFailed = false,
  onArchive,
  archiving = false,
}: PhotoViewerProps) {
  const { t, i18n } = useTranslation('media');
  const titleId = useId();
  const touchX = useRef<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const open = index !== null && photos.length > 0;
  const i = open ? Math.min(index, photos.length - 1) : 0;
  const photo = photos[i];
  const total = photos.length;

  useEffect(() => setConfirming(false), [index]);

  const go = (delta: number) => {
    if (total < 2) return;
    onIndexChange((i + delta + total) % total);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  };
  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchX.current;
    const end = e.changedTouches[0]?.clientX;
    touchX.current = null;
    if (start == null || end == null) return;
    if (end - start > SWIPE_PX) go(-1);
    else if (start - end > SWIPE_PX) go(1);
  };

  const taken = photo?.capturedAt
    ? t('viewer.taken', {
        date: new Intl.DateTimeFormat(i18n.language, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(photo.capturedAt)),
      })
    : null;
  const src = originalUrl ?? photo?.thumbUrl ?? undefined;

  return (
    <Dialog
      open={open}
      onClose={() => onIndexChange(null)}
      fullScreen
      aria-labelledby={titleId}
      onKeyDown={onKey}
      PaperProps={{
        sx: {
          bgcolor: tokens.colors.neutral[900],
          color: tokens.colors.neutral[50],
        },
      }}
    >
      <Stack direction='row' alignItems='center' sx={{ px: 1, py: 0.5 }}>
        <Typography
          id={titleId}
          variant='subtitle1'
          component='h2'
          sx={{ flex: 1, px: 1 }}
        >
          {t('viewer.title', { index: i + 1, total })}
        </Typography>
        <IconButton
          onClick={() => onIndexChange(null)}
          aria-label={t('viewer.close')}
          sx={{ color: 'inherit' }}
        >
          <CloseOutlined />
        </IconButton>
      </Stack>

      <Box
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        sx={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'pan-y',
        }}
      >
        {src && (
          <Box
            component='img'
            src={src}
            alt={
              photo?.caption ??
              taken ??
              t('viewer.title', { index: i + 1, total })
            }
            sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        )}
        {total > 1 && (
          <>
            <IconButton
              onClick={() => go(-1)}
              aria-label={t('viewer.previous')}
              sx={{
                position: 'absolute',
                left: tokens.spacing[2],
                color: 'inherit',
                bgcolor: alpha(tokens.colors.neutral[900], 0.5),
              }}
            >
              <ChevronLeftOutlined fontSize='large' />
            </IconButton>
            <IconButton
              onClick={() => go(1)}
              aria-label={t('viewer.next')}
              sx={{
                position: 'absolute',
                right: tokens.spacing[2],
                color: 'inherit',
                bgcolor: alpha(tokens.colors.neutral[900], 0.5),
              }}
            >
              <ChevronRightOutlined fontSize='large' />
            </IconButton>
          </>
        )}
      </Box>

      <Stack spacing={1} sx={{ p: 2 }}>
        {originalLoading && (
          <Typography variant='caption' aria-live='polite'>
            {t('viewer.loading')}
          </Typography>
        )}
        {originalFailed && (
          <Alert severity='warning' variant='filled'>
            {t('viewer.failed')}
          </Alert>
        )}
        {photo?.caption && <Typography>{photo.caption}</Typography>}
        {taken && (
          <Typography variant='body2' sx={{ opacity: 0.8 }}>
            {taken}
          </Typography>
        )}
        {onArchive && photo && (
          <Stack
            direction='row'
            spacing={1}
            alignItems='center'
            useFlexGap
            flexWrap='wrap'
          >
            {confirming ? (
              <>
                <Typography variant='body2' sx={{ flex: 1 }}>
                  {t('viewer.confirmArchive')}
                </Typography>
                <Button
                  color='inherit'
                  onClick={() => setConfirming(false)}
                  disabled={archiving}
                >
                  {t('viewer.cancel')}
                </Button>
                <Button
                  variant='contained'
                  color='error'
                  onClick={() => onArchive(photo)}
                  disabled={archiving}
                >
                  {t('viewer.confirm')}
                </Button>
              </>
            ) : (
              <Button
                color='inherit'
                variant='outlined'
                onClick={() => setConfirming(true)}
              >
                {t('viewer.archive')}
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Dialog>
  );
}

export default PhotoViewer;
