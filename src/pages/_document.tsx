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
