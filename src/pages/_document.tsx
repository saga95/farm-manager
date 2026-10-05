import {
  type DocumentContext,
  type DocumentProps,
  Head,
  Html,
  Main,
  NextScript,
} from 'next/document';
import {
  DocumentHeadTags,
  type DocumentHeadTagsProps,
  documentGetInitialProps,
} from '@mui/material-nextjs/v14-pagesRouter';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { darkSemanticTheme, lightSemanticTheme } from '@/design-system';

export default function Document(props: DocumentProps & DocumentHeadTagsProps) {
  return (
    <Html lang='en'>
      <Head>
        <DocumentHeadTags {...props} />
        {/* Installable app (#104): manifest + iOS home-screen icon */}
        <link rel='manifest' href='/manifest.json' />
        <link rel='apple-touch-icon' href='/icons/apple-touch-icon.png' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='default' />
        <meta name='apple-mobile-web-app-title' content='Farm' />
        {/* Mobile browser chrome follows the app background */}
        <meta
          name='theme-color'
          content={lightSemanticTheme.brand.base}
          media='(prefers-color-scheme: light)'
        />
        <meta
          name='theme-color'
          content={darkSemanticTheme.bg.base}
          media='(prefers-color-scheme: dark)'
        />
      </Head>
      <body>
        {/* Sets .light/.dark on <html> before paint to avoid a theme flash */}
        <InitColorSchemeScript attribute='class' />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

Document.getInitialProps = async (ctx: DocumentContext) =>
  documentGetInitialProps(ctx);
