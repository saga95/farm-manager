/**
 * ConnectionBanner (#103, SRS §30): says when the phone is offline and how many
 * changes (tree counts, photos) are waiting on this phone to be sent. Hidden
 * when there is nothing to say.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useUploadQueue } from '@/features/media/MediaUploadProvider';
import type { QueuedUpload } from '@/features/media/uploadQueue';
import {
  useFlushOutbox,
  useOnline,
  usePendingHarvests,
} from '@/features/plucking/OutboxProvider';

function useUploads(): readonly QueuedUpload[] {
  const queue = useUploadQueue();
  const [entries, setEntries] = useState<readonly QueuedUpload[]>([]);
  useEffect(() => {
    if (!queue) return undefined;
    setEntries(queue.snapshot());
    return queue.subscribe(setEntries);
  }, [queue]);
  return entries;
}

export function ConnectionBanner() {
  const { t } = useTranslation('shell');
  const online = useOnline();
  const harvests = usePendingHarvests();
  const uploads = useUploads();
  const flush = useFlushOutbox();
  const queue = useUploadQueue();
  const waiting =
    harvests.filter(h => h.state === 'PENDING').length +
    uploads.filter(u => u.state !== 'FAILED').length;
  const failed =
    harvests.filter(h => h.state === 'FAILED').length +
    uploads.filter(u => u.state === 'FAILED').length;
  if (online && waiting === 0 && failed === 0) return null;
  const sendNow = () => {
    void flush();
    uploads
      .filter(u => u.state === 'FAILED')
      .forEach(u => void queue?.retry(u.mediaId));
  };
  return (
    <Stack spacing={1} sx={{ mb: 2 }} role='status' aria-live='polite'>
      {!online && <Alert severity='info'>{t('connection.offline')}</Alert>}
      {(waiting > 0 || failed > 0) && (
        <Alert
          severity={failed > 0 ? 'warning' : 'info'}
          action={
            online ? (
              <Button color='inherit' size='small' onClick={sendNow}>
                {t('connection.retry')}
              </Button>
            ) : undefined
          }
        >
          {[
            waiting > 0 ? t('connection.pending', { count: waiting }) : null,
            failed > 0 ? t('connection.failed', { count: failed }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Alert>
      )}
    </Stack>
  );
}

export default ConnectionBanner;
