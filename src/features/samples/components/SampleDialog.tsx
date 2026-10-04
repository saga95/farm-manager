/**
 * SampleDialog: record the dehusked sample size for one tree (SCR-012, §9).
 * Four big size buttons (one tap), optional weight. Full-screen on phones.
 *
 * @accessibility Sizes are a labelled radio group of toggle buttons (text, not
 * colour); errors use role="alert".
 */

import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { tokens } from '@/design-system';
import { SIZE_CLASSES, type SizeClass } from '@/domain/samples';

export interface SampleDialogProps {
  open: boolean;
  treeCode: string;
  initialSize?: string | null | undefined;
  initialWeight?: number | null | undefined;
  saving: boolean;
  error?: string | null | undefined;
  hasNext: boolean;
  onSave: (size: SizeClass, weight: number | null) => void;
  onClose: () => void;
}

export function SampleDialog({
  open,
  treeCode,
  initialSize,
  initialWeight,
  saving,
  error,
  hasNext,
  onSave,
  onClose,
}: SampleDialogProps) {
  const { t } = useTranslation('samples');
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();
  const groupId = useId();
  const [size, setSize] = useState<SizeClass | null>(null);
  const [weight, setWeight] = useState('');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSize(
      (SIZE_CLASSES as readonly string[]).includes(initialSize ?? '')
        ? (initialSize as SizeClass)
        : null
    );
    setWeight(initialWeight != null ? String(initialWeight) : '');
    setMissing(false);
  }, [open, treeCode, initialSize, initialWeight]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!size) {
      setMissing(true);
      return;
    }
    const w = weight.trim() === '' ? null : Number(weight);
    onSave(size, w !== null && Number.isFinite(w) && w > 0 ? w : null);
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth='xs'
      aria-labelledby={titleId}
      PaperProps={
        { component: 'form', onSubmit: submit, noValidate: true } as object
      }
    >
      <DialogTitle id={titleId}>
        {t('dialog.title', { code: treeCode })}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {(error || missing) && (
            <Alert severity='error' role='alert'>
              {error ?? t('dialog.pickSize')}
            </Alert>
          )}
          <Typography id={groupId} variant='subtitle2'>
            {t('dialog.question')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={size}
            onChange={(_, v: SizeClass | null) => v && setSize(v)}
            aria-labelledby={groupId}
            orientation='vertical'
            fullWidth
          >
            {SIZE_CLASSES.map(s => (
              <ToggleButton
                key={s}
                value={s}
                sx={{
                  minHeight: tokens.spacing[14],
                  fontSize:
                    s === 'UNCLASSIFIED'
                      ? tokens.typography.fontSize.base
                      : tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.bold,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                  },
                  '&.Mui-selected:hover': { bgcolor: 'primary.dark' },
                }}
              >
                {t(`sizes.${s}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField
            label={t('dialog.weight')}
            value={weight}
            onChange={e => setWeight(e.target.value.replace(/[^\d.]/g, ''))}
            inputMode='decimal'
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={saving}
          color='inherit'
          sx={{ mr: 'auto' }}
        >
          {t('dialog.cancel')}
        </Button>
        <Button
          type='submit'
          variant='contained'
          size='large'
          disabled={saving}
        >
          {saving
            ? t('dialog.saving')
            : hasNext
              ? t('dialog.saveNext')
              : t('dialog.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SampleDialog;
