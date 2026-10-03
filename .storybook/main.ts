import type { StorybookConfig } from '@storybook/experimental-nextjs-vite';

// Vite-based Next.js framework. The webpack-based @storybook/nextjs fails
// against Next 14.2's compiled webpack ("reading 'tap'").
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
  ],
  framework: { name: '@storybook/experimental-nextjs-vite', options: {} },
  // Serves /locales/** so i18next-http-backend works inside stories
  staticDirs: ['../public'],
  docs: { autodocs: 'tag' },
  core: { disableTelemetry: true },
  viteFinal: async viteConfig => ({
    ...viteConfig,
    build: {
      ...viteConfig.build,
      chunkSizeWarningLimit: 2048,
      rollupOptions: {
        ...viteConfig.build?.rollupOptions,
        // MUI ships "use client" directives, which are irrelevant in Storybook
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
          warn(warning);
        },
      },
    },
  }),
};

export default config;
