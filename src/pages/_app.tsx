import '@/styles/globals.css';
import '@aws-amplify/ui-react/styles.css';
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { DM_Sans } from 'next/font/google';
import { AppCacheProvider } from '@mui/material-nextjs/v14-pagesRouter';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import { appTheme } from '@/lib/theme';
import { Amplify } from 'aws-amplify';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary, {
  RootErrorBoundary,
  RouteErrorBoundary,
} from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { RBACProvider } from '@/contexts/RBACContext';
import { resolveProfileFromCognitoGroups } from '@/rbac';
import '@/lib/i18n'; // Initialize i18n
export { reportWebVitals } from '@/lib/webVitals';

// ─── Font ───────────────────────────────────────────────────────────────────────
// Self-hosted by next/font; exposed as --font-body so tokens.typography.fontFamily
// resolves to it everywhere, including MUI portals rendered outside the app root.

const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// ─── Amplify Provider ──────────────────────────────────────────────────────────

function AmplifyProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const configureAmplify = async () => {
      try {
        const outputs = await import('../../amplify_outputs.json');
        Amplify.configure(outputs.default);
      } catch {
        // In development without amplify_outputs.json, continue without Amplify
        console.warn(
          'Amplify outputs not found. Running without backend configuration.'
        );
      }
    };

    void configureAmplify();
  }, []);

  // Render children immediately — never gate the app tree (and therefore the
  // SSR/SSG output, including every <Head> tag) on Amplify configuration.
  // `useEffect` does not run during SSR, so a gate here would strip all page
  // content and meta tags from the server-rendered HTML that crawlers and
  // link-preview bots see. AuthContext already handles the "not configured
  // yet" state the same as "no session".
  // eslint-disable-next-line react/jsx-no-useless-fragment -- required for JSX return type
  return <>{children}</>;
}

// ─── Auth → RBAC Bridge ────────────────────────────────────────────────────────

/**
 * Reads the authenticated user's Cognito groups and maps them to the
 * appropriate RBAC profile, providing entitlements to the whole subtree.
 * When no user is logged in, an empty entitlement set is provided.
 */
function AuthenticatedRBACProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const profile = user
    ? (resolveProfileFromCognitoGroups(user.groups) ?? undefined)
    : undefined;

  return <RBACProvider profile={profile}>{children}</RBACProvider>;
}

// ─── React Query Client ────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 3,
      retryDelay: (attemptIndex: number) =>
        Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ─── App Component ─────────────────────────────────────────────────────────────

export default function App(props: AppProps) {
  const { Component, pageProps } = props;
  const router = useRouter();

  // Track page views (integrate with your analytics provider)
  useEffect(() => {
    const handleRouteChange = (_url: string) => {
      // Analytics tracking placeholder
      // Example: trackPageView(url);
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <AppCacheProvider {...props}>
      <ThemeProvider theme={appTheme} defaultMode='system'>
        <CssBaseline enableColorScheme />
        <GlobalStyles
          styles={{ ':root': { '--font-body': dmSans.style.fontFamily } }}
        />
        <RootErrorBoundary>
          <AmplifyProvider>
            <AuthProvider>
              <AuthenticatedRBACProvider>
                <QueryClientProvider client={queryClient}>
                  <ErrorBoundary level='app'>
                    <ToastProvider>
                      <a href='#main-content' className='skip-link'>
                        Skip to main content
                      </a>
                      <RouteErrorBoundary>
                        <Component {...pageProps} />
                      </RouteErrorBoundary>
                    </ToastProvider>
                  </ErrorBoundary>
                </QueryClientProvider>
              </AuthenticatedRBACProvider>
            </AuthProvider>
          </AmplifyProvider>
        </RootErrorBoundary>
      </ThemeProvider>
    </AppCacheProvider>
  );
}
