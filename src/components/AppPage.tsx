/**
 * AppPage: standard authenticated page wrapper: document <title>, noindex
 * (private farm data must not be indexed) and the AppShell frame.
 */

import type { ReactNode } from 'react';
import Head from 'next/head';
import { useTranslation } from 'react-i18next';
import {
  AppShell,
  type AppShellProps,
} from '@/components/ui/AppShell/AppShell';
import { ComingSoon } from '@/components/ui/ComingSoon/ComingSoon';

export interface AppPageProps extends Omit<AppShellProps, 'children'> {
  children: ReactNode;
}

export function AppPage({ title, children, ...shell }: AppPageProps) {
  const { t } = useTranslation('shell');
  return (
    <>
      <Head>
        <title>{`${title} · ${t('appName')}`}</title>
        <meta name='robots' content='noindex, nofollow' />
      </Head>
      <AppShell title={title} {...shell}>
        {children}
      </AppShell>
    </>
  );
}

/** Placeholder for sitemap routes whose screens are not built yet. */
export function ComingSoonPage() {
  const { t } = useTranslation('shell');
  return (
    <AppPage title={t('comingSoon.title')}>
      <ComingSoon />
    </AppPage>
  );
}

export default AppPage;
