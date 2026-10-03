/**
 * MUI v6 Theme Adapter
 *
 * Bridges the framework-agnostic design tokens in `tokens.ts` to Material UI.
 * Every value here is derived from `tokens` / the semantic themes: never
 * hardcode a color, size or radius in this file.
 *
 * Usage (app):
 *   import { appTheme } from '@/design-system';
 *   <ThemeProvider theme={appTheme}> … </ThemeProvider>
 *
 * `appTheme` carries both light and dark color schemes as CSS variables and
 * follows the OS preference by default (no flash of the wrong theme).
 */

import {
  type PaletteOptions,
  type ThemeOptions,
  createTheme,
} from '@mui/material/styles';
import { tokens } from './tokens';
import { type Theme as SemanticTheme, darkTheme, lightTheme } from './theme';

type Mode = 'light' | 'dark';

const px = (rem: string): number => parseFloat(rem) * 16;
const bp = (value: string): number => parseFloat(value);

/** Minimum interactive target (WCAG 2.2 AA, SRS §25.1 "large touch targets"). */
export const TOUCH_TARGET = px(tokens.spacing[12]); // 48px

const sharedTypography: ThemeOptions['typography'] = {
  fontFamily: tokens.typography.fontFamily.body,
  h1: {
    fontFamily: tokens.typography.fontFamily.display,
    fontSize: tokens.typography.fontSize['3xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    lineHeight: tokens.typography.lineHeight.tight,
    letterSpacing: tokens.typography.letterSpacing.tight,
  },
  h2: {
    fontFamily: tokens.typography.fontFamily.display,
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    lineHeight: tokens.typography.lineHeight.tight,
    letterSpacing: tokens.typography.letterSpacing.tight,
  },
  h3: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.semibold,
    lineHeight: tokens.typography.lineHeight.snug,
  },
  h4: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    lineHeight: tokens.typography.lineHeight.snug,
  },
  h5: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    lineHeight: tokens.typography.lineHeight.snug,
  },
  h6: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold,
    lineHeight: tokens.typography.lineHeight.snug,
  },
  body1: {
    fontSize: tokens.typography.fontSize.base,
    lineHeight: tokens.typography.lineHeight.normal,
  },
  body2: {
    fontSize: tokens.typography.fontSize.sm,
    lineHeight: tokens.typography.lineHeight.normal,
  },
  caption: {
    fontSize: tokens.typography.fontSize.xs,
    lineHeight: tokens.typography.lineHeight.normal,
  },
  overline: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.semibold,
    letterSpacing: tokens.typography.letterSpacing.widest,
  },
  button: {
    textTransform: 'none',
    fontWeight: tokens.typography.fontWeight.semibold,
  },
};

const sharedComponents: ThemeOptions['components'] = {
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        borderRadius: tokens.radius.lg,
        minHeight: TOUCH_TARGET,
        minWidth: TOUCH_TARGET,
        paddingInline: tokens.spacing[5],
      },
      sizeSmall: { minHeight: px(tokens.spacing[10]) }, // still ≥ 24px AA minimum
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET },
    },
  },
  MuiFab: {
    styleOverrides: { root: { boxShadow: tokens.shadow.lg } },
  },
  MuiTextField: {
    defaultProps: { fullWidth: true },
    styleOverrides: {
      root: { '& .MuiInputBase-root': { minHeight: TOUCH_TARGET } },
    },
  },
  MuiCard: {
    defaultProps: { variant: 'outlined' },
    styleOverrides: { root: { borderRadius: tokens.radius.xl } },
  },
  MuiPaper: {
    styleOverrides: { rounded: { borderRadius: tokens.radius.xl } },
  },
  MuiChip: {
    styleOverrides: {
      root: { fontWeight: tokens.typography.fontWeight.medium },
    },
  },
  MuiBottomNavigationAction: {
    styleOverrides: {
      root: { minWidth: TOUCH_TARGET, paddingTop: tokens.spacing[2] },
      label: {
        fontSize: tokens.typography.fontSize.xs,
        '&.Mui-selected': { fontSize: tokens.typography.fontSize.xs },
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: { minHeight: TOUCH_TARGET, borderRadius: tokens.radius.lg },
    },
  },
};

function palette(mode: Mode, sem: SemanticTheme): PaletteOptions {
  const dark = mode === 'dark';
  return {
    mode,
    primary: {
      main: sem.brand.base,
      light: dark ? tokens.colors.brand[300] : tokens.colors.brand[500],
      dark: sem.brand.emphasis,
      contrastText: dark
        ? tokens.colors.neutral[950]
        : tokens.colors.neutral[0],
    },
    secondary: {
      main: sem.accent.base,
      light: dark ? tokens.colors.earth[200] : tokens.colors.earth[400],
      dark: sem.accent.emphasis,
      contrastText: dark
        ? tokens.colors.neutral[950]
        : tokens.colors.neutral[0],
    },
    error: {
      main: dark ? tokens.colors.error.base : tokens.colors.error.dark,
      light: tokens.colors.error.light,
      dark: tokens.colors.error.dark,
    },
    warning: {
      main: dark ? tokens.colors.warning.base : tokens.colors.warning.dark,
      light: tokens.colors.warning.light,
      dark: tokens.colors.warning.dark,
    },
    info: {
      main: dark ? tokens.colors.info.base : tokens.colors.info.dark,
      light: tokens.colors.info.light,
      dark: tokens.colors.info.dark,
    },
    success: {
      main: dark ? tokens.colors.success.base : tokens.colors.success.dark,
      light: tokens.colors.success.light,
      dark: tokens.colors.success.dark,
    },
    background: { default: sem.bg.subtle, paper: sem.bg.base },
    text: { primary: sem.fg.base, secondary: sem.fg.muted },
    divider: sem.border.base,
  };
}

export const lightMuiThemeOptions: ThemeOptions = {
  palette: palette('light', lightTheme),
  shape: { borderRadius: px(tokens.radius.md) },
  typography: sharedTypography,
  components: sharedComponents,
};

export const darkMuiThemeOptions: ThemeOptions = {
  palette: palette('dark', darkTheme),
  shape: { borderRadius: px(tokens.radius.md) },
  typography: sharedTypography,
  components: sharedComponents,
};

/** Returns MUI ThemeOptions for a single mode (Storybook, tests). */
export function buildMuiTheme(mode: Mode): ThemeOptions {
  return mode === 'dark' ? darkMuiThemeOptions : lightMuiThemeOptions;
}

/**
 * The application theme: light + dark color schemes, emitted as CSS variables
 * and switched with a `.light` / `.dark` class on <html> (set before paint by
 * `InitColorSchemeScript` in `_document.tsx`). Defaults to the OS preference.
 */
export const appTheme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: { palette: palette('light', lightTheme) },
    dark: { palette: palette('dark', darkTheme) },
  },
  shape: { borderRadius: px(tokens.radius.md) },
  typography: sharedTypography,
  components: sharedComponents,
  // Mirrors tokens.breakpoints (SRS mobile-first: xs is the phone baseline)
  breakpoints: {
    values: {
      xs: 0,
      sm: bp(tokens.breakpoints.sm),
      md: bp(tokens.breakpoints.md),
      lg: bp(tokens.breakpoints.lg),
      xl: bp(tokens.breakpoints.xl),
    },
  },
});
