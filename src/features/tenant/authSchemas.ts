import { z } from 'zod';

/** Mirrors the Cognito password policy in amplify/backend.ts. */
export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/** Schemas take translated messages so validation text stays i18n-ready. */
export const loginSchema = (m: { email: string; password: string }) =>
  z.object({
    email: z.string().trim().email(m.email),
    password: z.string().min(1, m.password),
  });

export const registerSchema = (m: {
  email: string;
  password: string;
  match: string;
}) =>
  z
    .object({
      givenName: z.string().trim().max(60).optional(),
      familyName: z.string().trim().max(60).optional(),
      email: z.string().trim().email(m.email),
      password: z.string().regex(PASSWORD_PATTERN, m.password),
      confirmPassword: z.string(),
    })
    .refine(d => d.password === d.confirmPassword, {
      message: m.match,
      path: ['confirmPassword'],
    });

export const codeSchema = (m: { code: string }) =>
  z
    .string()
    .trim()
    .regex(/^\d{6}$/, m.code);
