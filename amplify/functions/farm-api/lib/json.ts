import { type ZodTypeAny, z } from 'zod';

/** AWSJSON arguments may arrive as a JSON string or already parsed. */
export const parseJson = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    return v;
  }
};

/** A schema for an AWSJSON argument: accepts the string or the parsed value. */
export const jsonArg = <T extends ZodTypeAny>(schema: T): T =>
  z.preprocess(parseJson, schema) as unknown as T;
