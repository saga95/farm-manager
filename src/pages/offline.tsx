import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined';

/** Shown by the service worker for pages not yet opened on this phone while offline. */
export default function OfflinePage() {
  const { t } = useTranslation('shell');
  return (
    <Box
      component='main'
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 3,
        textAlign: 'center',
      }}
    >
      <CloudOffOutlined sx={{ fontSize: 48 }} color='disabled' aria-hidden />
      <Typography variant='h2' component='h1'>
        {t('offline.title')}
      </Typography>
      <Typography color='text.secondary' sx={{ maxWidth: 360 }}>
        {t('offline.body')}
      </Typography>
      <Button variant='contained' onClick={() => window.location.reload()}>
        {t('offline.retry')}
      </Button>
    </Box>
  );
}
