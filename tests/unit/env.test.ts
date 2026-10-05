import { describe, expect, it } from 'vitest';
import { assertStartupConfig, hasApiKey, parseEnv } from '@/lib/config/env';

describe('parseEnv', () => {
  it('applies .env.example defaults', () => {
    const env = parseEnv({});
    expect(env.DATABASE_PROVIDER).toBe('sqlite');
    expect(env.WAREHOUSE_ADAPTER).toBe('duckdb');
    expect(env.AGENT_MODE_DEFAULT).toBe('scripted');
    expect(env.LLM_TIMEOUT_MS).toBe(12_000);
    expect(env.LLM_MAX_TOOL_ROUNDS).toBe(6);
  });

  it('treats empty strings as unset', () => {
    const env = parseEnv({ ANTHROPIC_API_KEY: '', AGENT_MODE_DEFAULT: '' });
    expect(hasApiKey(env)).toBe(false);
    expect(env.AGENT_MODE_DEFAULT).toBe('scripted');
  });

  it('rejects unknown modes', () => {
    expect(() => parseEnv({ AGENT_MODE_DEFAULT: 'yolo' })).toThrow();
  });

  it('reports key presence without exposing it', () => {
    expect(hasApiKey(parseEnv({ ANTHROPIC_API_KEY: 'sk-test' }))).toBe(true);
  });
});

describe('assertStartupConfig', () => {
  it('refuses the default session secret in production', () => {
    expect(() => assertStartupConfig(parseEnv({ NODE_ENV: 'production' }))).toThrow(/SESSION_SECRET/);
  });

  it('accepts a custom secret in production and the default in development', () => {
    expect(() => assertStartupConfig(parseEnv({ NODE_ENV: 'production', SESSION_SECRET: 's3cret-value' }))).not.toThrow();
    expect(() => assertStartupConfig(parseEnv({ NODE_ENV: 'development' }))).not.toThrow();
  });
});
