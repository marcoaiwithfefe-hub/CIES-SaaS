import { z } from 'zod';

/**
 * Server-only environment schema.
 * Validated at startup — the app will crash fast with a clear error
 * if any required variable is missing or malformed.
 *
 * SECURITY: No NEXT_PUBLIC_ variables allowed here.
 * All secrets remain in the Node.js server runtime only.
 */
const serverSchema = z.object({
  /** Shared secret for internal Server Action authentication */
  INTERNAL_API_SECRET: z.string().min(32, {
    message: 'INTERNAL_API_SECRET must be at least 32 characters for cryptographic safety',
  }),

  /** Node environment */
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

type ServerEnv = z.infer<typeof serverSchema>;

function validateEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌  Invalid environment variables:\n');
    parsed.error.issues.forEach((issue) => {
      console.error(`  → ${issue.path.join('.')}: ${issue.message}`);
    });
    throw new Error('Environment validation failed. Set all required variables before starting.');
  }

  return parsed.data;
}

/**
 * Validated, type-safe environment variables.
 * Import this instead of accessing process.env directly.
 *
 * @example
 * import { env } from '@/env';
 * const secret = env.INTERNAL_API_SECRET;
 */
export const env = validateEnv();
