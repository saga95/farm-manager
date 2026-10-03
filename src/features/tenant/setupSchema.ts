import { z } from 'zod';

export const AREA_UNITS = ['ACRE', 'HECTARE', 'PERCH', 'SQ_M'] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

export const CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'INR', 'AUD'] as const;
export const LOCALES = ['en'] as const;

/** Sensible defaults for the first validation tenant (Sri Lanka). */
export const SETUP_DEFAULTS = {
  defaultTimezone: 'Asia/Colombo',
  defaultCurrency: 'LKR',
  defaultLocale: 'en',
  farmAreaUnit: 'ACRE' as AreaUnit,
};

export interface SetupMessages {
  required: string;
  tooLong: (max: number) => string;
  area: string;
}

/** Client-side mirror of the server's createTenant validation (server is authoritative). */
export const setupSchema = (m: SetupMessages) =>
  z.object({
    name: z.string().trim().min(1, m.required).max(80, m.tooLong(80)),
    farmName: z.string().trim().min(1, m.required).max(80, m.tooLong(80)),
    farmArea: z
      .string()
      .trim()
      .transform(v => (v === '' ? null : Number(v)))
      .refine(v => v === null || (Number.isFinite(v) && v > 0), m.area),
    farmAreaUnit: z.enum(AREA_UNITS),
    farmLocationLabel: z
      .string()
      .trim()
      .max(120, m.tooLong(120))
      .transform(v => (v === '' ? null : v)),
    defaultTimezone: z.string().min(1, m.required),
    defaultCurrency: z.enum(CURRENCIES),
    defaultLocale: z.enum(LOCALES),
  });

export function timeZones(): string[] {
  try {
    const intl = Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    };
    const zones = intl.supportedValuesOf?.('timeZone');
    if (zones && zones.length > 0) return zones;
  } catch {
    // fall through
  }
  return [SETUP_DEFAULTS.defaultTimezone, 'UTC'];
}
