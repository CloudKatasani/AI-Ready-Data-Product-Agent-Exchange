import { z } from 'zod';

/**
 * Server-side configuration, parsed once from process.env (02-architecture §6).
 * Never import this module from a client component: it can see ANTHROPIC_API_KEY (invariant I11).
 */
export const AgentMode = z.enum(['scripted', 'live', 'auto']);
export type AgentMode = z.infer<typeof AgentMode>;

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_PROVIDER: z.enum(['sqlite', 'postgresql']).default('sqlite'),
  DATABASE_URL: z.string().default('file:../data/keystone.db'),
  WAREHOUSE_ADAPTER: z.enum(['duckdb', 'snowflake']).default('duckdb'),
  WAREHOUSE_DIR: z.string().default('./data/warehouse'),
  DEMO_SCALE: z.enum(['S', 'M', 'L']).default('M'),
  AGENT_MODE_DEFAULT: AgentMode.default('scripted'),
  ANTHROPIC_API_KEY: z.string().optional(),
  KEYSTONE_MODEL_ANSWER: z.string().optional(),
  KEYSTONE_MODEL_LIFECYCLE: z.string().optional(),
  KEYSTONE_MODEL_FAST: z.string().optional(),
  KEYSTONE_MODEL_DRAFTER: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(12_000),
  LLM_MAX_TOOL_ROUNDS: z.coerce.number().int().positive().default(6),
  LLM_BUDGET_USD_PER_SESSION: z.coerce.number().positive().default(5),
  SESSION_SECRET: z.string().default('change-me'),
  // Snowflake SQL API (WAREHOUSE_ADAPTER=snowflake, ADR-0025). Key-pair auth; the key file path only.
  SNOWFLAKE_ACCOUNT: z.string().optional(),
  SNOWFLAKE_USER: z.string().optional(),
  SNOWFLAKE_PRIVATE_KEY_PATH: z.string().optional(),
  SNOWFLAKE_WAREHOUSE: z.string().optional(),
  SNOWFLAKE_ROLE: z.string().optional(),
  /** Override the API host (default `<account>.snowflakecomputing.com`); used by tests and private links. */
  SNOWFLAKE_HOST: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const DEFAULT_SESSION_SECRET = 'change-me';

export function parseEnv(source: Record<string, string | undefined>): Env {
  // Empty strings in .env mean "unset".
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
  return EnvSchema.parse(cleaned);
}

/** Called once at server start (src/instrumentation.ts): production refuses the default secret. */
export function assertStartupConfig(env: Env): void {
  if (env.NODE_ENV === 'production' && env.SESSION_SECRET === DEFAULT_SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be changed from its default in production (see .env.example).');
  }
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Whether live LLM mode can be offered. Exposes presence only — never the key itself. */
export function hasApiKey(env: Env = getEnv()): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/** The API key, for constructing the server-side SDK client only. Never log it or pass it to the browser. */
export function anthropicApiKey(env: Env = getEnv()): string | undefined {
  return env.ANTHROPIC_API_KEY;
}

export interface SnowflakeConfig {
  account: string;
  user: string;
  privateKeyPath: string;
  warehouse?: string;
  role?: string;
  host?: string;
}

/** Snowflake connection settings, or null when incomplete. The private key stays on disk (path only here). */
export function snowflakeConfig(env: Env = getEnv()): SnowflakeConfig | null {
  if (!env.SNOWFLAKE_ACCOUNT || !env.SNOWFLAKE_USER || !env.SNOWFLAKE_PRIVATE_KEY_PATH) return null;
  return {
    account: env.SNOWFLAKE_ACCOUNT,
    user: env.SNOWFLAKE_USER,
    privateKeyPath: env.SNOWFLAKE_PRIVATE_KEY_PATH,
    ...(env.SNOWFLAKE_WAREHOUSE ? { warehouse: env.SNOWFLAKE_WAREHOUSE } : {}),
    ...(env.SNOWFLAKE_ROLE ? { role: env.SNOWFLAKE_ROLE } : {}),
    ...(env.SNOWFLAKE_HOST ? { host: env.SNOWFLAKE_HOST } : {}),
  };
}
