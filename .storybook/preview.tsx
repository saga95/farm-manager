import type { Preview } from '@storybook/react';
import { withThemeFromJSXProvider } from '@storybook/addon-themes';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { buildMuiTheme } from '../design-system';
import '../src/lib/i18n';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    a11y: { test: 'error' },
    viewport: { defaultViewport: 'mobile2' },
    nextjs: { router: { pathname: '/' } },
  },
  decorators: [
    withThemeFromJSXProvider({
      themes: {
        light: createTheme(buildMuiTheme('light')),
        dark: createTheme(buildMuiTheme('dark')),
      },
      defaultTheme: 'light',
      Provider: ThemeProvider,
      GlobalStyles: CssBaseline,
    }),
  ],
};

export default preview;
