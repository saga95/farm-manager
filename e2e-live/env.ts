/** Test-account credentials for the live dev suite (#128). */
export const accounts = {
  a: {
    email: process.env['E2E_DEV_EMAIL'] ?? '',
    password: process.env['E2E_DEV_PASSWORD'] ?? '',
  },
  b: {
    email: process.env['E2E_DEV_EMAIL_B'] ?? '',
    password: process.env['E2E_DEV_PASSWORD_B'] ?? '',
  },
};
export const hasA = Boolean(accounts.a.email && accounts.a.password);
export const hasB = Boolean(accounts.b.email && accounts.b.password);
export const STATE = { a: 'e2e-live/.auth/a.json', b: 'e2e-live/.auth/b.json' };
/** Unique per run so repeated runs never collide. */
export const RUN = new Date().toISOString().replace(/\D/g, '').slice(2, 12);
