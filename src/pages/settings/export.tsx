import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import { AppPage } from '@/components/AppPage';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { useCurrentFarm } from '@/features/farm/hooks';
import { useTenant } from '@/features/tenant';
import { type ExportKind, exportCsv } from '@/lib/api';

const KINDS: readonly ExportKind[] = [
  'trees',
  'harvests',
  'samples',
  'sales',
  'stock',
];

/** Save a text file in the browser (no server URL involved). */
function download(filename: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/csv;charset=utf-8' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV export of this farm's records (#106, §5.2). */
export default function ExportPage() {
  const { t } = useTranslation('records');
  const { can } = useTenant();
  const { tenantId, farm } = useCurrentFarm();
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: ExportKind) => {
    if (!farm) return;
    setBusy(kind);
    setError(null);
    try {
      const file = await exportCsv(tenantId, farm.id, kind);
      download(file.filename, file.csv);
    } catch {
      setError(t('export.failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppPage title={t('export.title')}>
      {!can('export.data') ? (
        <EmptyState size='page' message={t('export.noAccess')} />
      ) : (
        <Stack spacing={2}>
          <Typography color='text.secondary'>{t('export.intro')}</Typography>
          {error && (
            <Alert severity='error' role='alert'>
              {error}
            </Alert>
          )}
          {KINDS.map(k => (
            <Card key={k}>
              <CardContent
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <Typography sx={{ fontWeight: 600 }}>
                  {t(`export.kinds.${k}`)}
                </Typography>
                <Button
                  variant='outlined'
                  startIcon={<FileDownloadOutlined aria-hidden />}
                  onClick={() => void run(k)}
                  disabled={busy !== null || !farm}
                  aria-label={`${t('export.download')}: ${t(`export.kinds.${k}`)}`}
                >
                  {busy === k ? t('export.preparing') : t('export.download')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </AppPage>
  );
}
