/**
 * AppPage: standard authenticated page wrapper: document <title>, noindex
 * (private farm data must not be indexed), the sign-in/tenant gate and the
 * AppShell frame with the current tenant's name.
 */

import type { ReactNode } from 'react';
import Head from 'next/head';
import { useTranslation } from 'react-i18next';
import {
  AppShell,
  type AppShellProps,
} from '@/components/ui/AppShell/AppShell';
import { ComingSoon } from '@/components/ui/ComingSoon/ComingSoon';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { AppGate, useTenant } from '@/features/tenant';

export interface AppPageProps extends Omit<AppShellProps, 'children'> {
  children: ReactNode;
}

function ShellWithTenant({
  farmName,
  showQuickActions,
  children,
  ...shell
}: AppPageProps) {
  const { tenant, can } = useTenant();
  // VIEWERs (no capture rights) don't get quick actions (ux-docs IA notes)
  const canCapture =
    can('round.record') ||
    can('harvest.record') ||
    can('sale.record') ||
    can('inventory.adjust');
  return (
    <AppShell
      {...shell}
      farmName={farmName ?? tenant?.tenantName}
      showQuickActions={(showQuickActions ?? true) && canCapture}
    >
      <ConnectionBanner />
      {children}
    </AppShell>
  );
}

export function AppPage({ title, ...rest }: AppPageProps) {
  const { t } = useTranslation('shell');
  return (
    <>
      <Head>
        <title>{`${title} · ${t('appName')}`}</title>
        <meta name='robots' content='noindex, nofollow' />
      </Head>
      <AppGate>
        <ShellWithTenant title={title} {...rest} />
      </AppGate>
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
