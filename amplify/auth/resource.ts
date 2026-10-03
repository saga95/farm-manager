import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';

/**
 * Authentication configuration using Amazon Cognito.
 * Pattern from politica, friday.lk, tmsaaokenki-dev/website, and uwu-sri-lanka/website.
 *
 * Features:
 * - Email login only (no phone / SMS)
 * - User groups for RBAC (Admin, Shopper)
 * - Post-confirmation Lambda to assign default group
 * - Optional MFA (authenticator app / TOTP)
 * - User attributes: given name, family name
 *
 * Customize login methods and user attributes as needed.
 */
export const auth = defineAuth({
  loginWith: {
    // Email only (PO decision 2026-10-03): no phone sign-in and no SMS costs.
    email: {
      verificationEmailStyle: 'CODE',
      verificationEmailSubject:
        'My Smart Need AgriTech: your verification code',
    },
  },
  userAttributes: {
    givenName: { required: false, mutable: true },
    familyName: { required: false, mutable: true },
  },
  // Optional authenticator-app MFA only; SMS is off to avoid per-message costs.
  multifactor: {
    mode: 'OPTIONAL',
    totp: true,
  },
  groups: ['Admin', 'Shopper'],
  triggers: {
    postConfirmation,
  },
});
