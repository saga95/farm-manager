import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import enAuth from '../../public/locales/en/auth.json';
import enCoconut from '../../public/locales/en/coconut.json';
import enCommon from '../../public/locales/en/common.json';
import enDashboard from '../../public/locales/en/dashboard.json';
import enFarm from '../../public/locales/en/farm.json';
import enForms from '../../public/locales/en/forms.json';
import enGrowing from '../../public/locales/en/growing.json';
import enInventory from '../../public/locales/en/inventory.json';
import enNavigation from '../../public/locales/en/navigation.json';
import enPlucking from '../../public/locales/en/plucking.json';
import enMedia from '../../public/locales/en/media.json';
import enSales from '../../public/locales/en/sales.json';
import enSamples from '../../public/locales/en/samples.json';
import enSetup from '../../public/locales/en/setup.json';
import enShell from '../../public/locales/en/shell.json';
import enTeam from '../../public/locales/en/team.json';

/**
 * English is bundled into the build so the server-rendered HTML and the first
 * client render contain real text, not translation keys (#120, SRS §25.2).
 * Other languages (Sinhala/Tamil later, SRS §25.6) load over HTTP on demand.
 */
export const NAMESPACES = [
  'common',
  'navigation',
  'forms',
  'shell',
  'dashboard',
  'auth',
  'setup',
  'farm',
  'coconut',
  'plucking',
  'samples',
  'media',
  'inventory',
  'sales',
  'growing',
  'team',
] as const;

const resources = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    forms: enForms,
    shell: enShell,
    dashboard: enDashboard,
    auth: enAuth,
    setup: enSetup,
    farm: enFarm,
    coconut: enCoconut,
    plucking: enPlucking,
    samples: enSamples,
    media: enMedia,
    inventory: enInventory,
    sales: enSales,
    growing: enGrowing,
    team: enTeam,
  },
};

const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  i18n.use(Backend).use(LanguageDetector);
}

void i18n.use(initReactI18next).init({
  resources,
  // Bundled languages are complete; anything else may still come from the backend
  partialBundledLanguages: true,
  // Synchronous init: resources are already in memory
  initImmediate: false,
  // The server always renders English; the browser detects the language
  ...(isBrowser ? {} : { lng: 'en' }),
  fallbackLng: 'en',
  // English first (SRS §25.6). Sinhala (si) and Tamil (ta) will be added later.
  supportedLngs: ['en'],
  nonExplicitSupportedLngs: true,
  // Browsers report regional codes (en-US); only base-language files exist
  load: 'languageOnly',
  ns: [...NAMESPACES],
  defaultNS: 'common',
  debug: false,

  interpolation: {
    escapeValue: false, // React already does escaping
  },

  backend: {
    loadPath: '/locales/{{lng}}/{{ns}}.json',
  },

  detection: {
    order: ['localStorage', 'navigator', 'htmlTag'],
    caches: ['localStorage'],
  },

  react: {
    useSuspense: false,
  },
});

export default i18n;
