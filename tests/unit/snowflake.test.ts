import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { binding, convertCell, type FetchLike, jwtAccount, SnowflakeAdapter, SnowflakeError } from '@/lib/warehouse/snowflake';

/** ADR-0025: the Snowflake SQL API adapter, against a mocked API (no Snowflake account in CI). */
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const cfg = { account: 'xy12345.us-east-2.aws', user: 'demo_svc', privateKeyPath: 'unused', warehouse: 'WH_DEMO', role: 'DEMO_ROLE' };

type Call = { url: string; method: string; headers: Record<string, string>; body?: Record<string, unknown> };

function mockApi(routes: (call: Call) => { status: number; body: unknown }): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call: Call = { url, method: init.method, headers: init.headers, ...(init.body ? { body: JSON.parse(init.body) as Record<string, unknown> } : {}) };
    calls.push(call);
    const r = routes(call);
    return { status: r.status, json: async () => r.body };
  };
  return { fetch, calls };
}

const ROW_TYPE = [
  { name: 'REGION', type: 'text' },
  { name: 'N', type: 'fixed', scale: 0 },
  { name: 'PCT', type: 'fixed', scale: 2 },
  { name: 'AVG', type: 'real' },
  { name: 'FLAG', type: 'boolean' },
  { name: 'DAY', type: 'date' },
  { name: 'TS', type: 'timestamp_ntz' },
];

describe('Snowflake adapter (mocked SQL API)', () => {
  it('signs a key-pair JWT Snowflake accepts: RS256, account/user claims, public-key fingerprint', async () => {
    const { fetch, calls } = mockApi(() => ({ status: 200, body: { statementHandle: 'h', resultSetMetaData: { numRows: 0, rowType: [] }, data: [] } }));
    const a = new SnowflakeAdapter(cfg, { database: 'UTL_AI_PLATFORM', fetch, privateKeyPem: pem, nowMs: () => 1_800_000_000_000 });
    await a.query('SELECT 1');
    const auth = calls[0]?.headers.Authorization ?? '';
    expect(calls[0]?.headers['X-Snowflake-Authorization-Token-Type']).toBe('KEYPAIR_JWT');
    const [h = '', p = '', s = ''] = auth.replace('Bearer ', '').split('.');
    expect(verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url'))).toBe(true);
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString()) as { iss: string; sub: string; iat: number; exp: number };
    expect(claims.sub).toBe('XY12345.DEMO_SVC');
    expect(claims.iss).toMatch(/^XY12345\.DEMO_SVC\.SHA256:[A-Za-z0-9+/=]+$/);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(3600);
    expect(calls[0]?.url).toBe('https://xy12345.us-east-2.aws.snowflakecomputing.com/api/v2/statements');
  });

  it('binds parameters positionally, waits for async statements and reads every result partition', async () => {
    const { fetch, calls } = mockApi((c) => {
      if (c.method === 'POST') return { status: 202, body: { statementHandle: 'H1', statementStatusUrl: '/api/v2/statements/H1' } };
      if (c.url.endsWith('?partition=1')) return { status: 200, body: { data: [['West', '7', '12.50', '0.5', 'false', '20000', '1728000000.000000000']] } };
      return {
        status: 200,
        body: { statementHandle: 'H1', resultSetMetaData: { numRows: 2, rowType: ROW_TYPE, partitionInfo: [{ rowCount: 1 }, { rowCount: 1 }] }, data: [['East', '9007199254740993', '98.10', '1.25e1', 'true', '19723', '1704067200.123456789']] },
      };
    });
    const a = new SnowflakeAdapter(cfg, { database: 'UTL_AI_PLATFORM', fetch, privateKeyPem: pem, pollMs: 1 });
    const r = await a.query('SELECT * FROM CONFORMED_GOLD.X WHERE REGION = ? AND N > ? AND F = ?', ['East', 3, true], { timeoutMs: 4000 });
    const post = calls[0]?.body ?? {};
    expect(post).toMatchObject({ database: 'UTL_AI_PLATFORM', warehouse: 'WH_DEMO', role: 'DEMO_ROLE', timeout: 4 });
    expect(post.bindings).toEqual({ '1': { type: 'TEXT', value: 'East' }, '2': { type: 'FIXED', value: '3' }, '3': { type: 'BOOLEAN', value: 'true' } });
    expect(calls.map((c) => `${c.method} ${c.url.split('/statements')[1]}`)).toEqual(['POST ', 'GET /H1', 'GET /H1?partition=1']);
    expect(r.columns.map((c) => c.type)).toEqual(['VARCHAR', 'BIGINT', 'DECIMAL', 'DOUBLE', 'BOOLEAN', 'DATE', 'TIMESTAMP']);
    expect(r.rows).toEqual([
      ['East', '9007199254740993', 98.1, 12.5, true, '2024-01-01', '2024-01-01 00:00:00'],
      ['West', 7, 12.5, 0.5, false, '2024-10-04', '2024-10-04 00:00:00'],
    ]);
    expect(r.truncated).toBe(false);
  });

  it('honours maxRows without fetching further partitions, and marks the result truncated', async () => {
    const { fetch, calls } = mockApi(() => ({ status: 200, body: { statementHandle: 'H2', resultSetMetaData: { numRows: 3, rowType: [ROW_TYPE[0]], partitionInfo: [{ rowCount: 2 }, { rowCount: 1 }] }, data: [['a'], ['b']] } }));
    const r = await new SnowflakeAdapter(cfg, { database: 'D', fetch, privateKeyPem: pem }).query('SELECT 1', [], { maxRows: 2 });
    expect(r.rows).toEqual([['a'], ['b']]);
    expect(r.truncated).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('turns API errors into SnowflakeError with the SQL state', async () => {
    const { fetch } = mockApi(() => ({ status: 422, body: { code: '002003', sqlState: '42S02', message: 'Object does not exist' } }));
    const err = await new SnowflakeAdapter(cfg, { database: 'D', fetch, privateKeyPem: pem }).query('SELECT 1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SnowflakeError);
    expect((err as SnowflakeError).sqlState).toBe('42S02');
  });

  it('describe() reads DESCRIBE TABLE in the pack database and rejects unsafe names', async () => {
    const { fetch, calls } = mockApi(() => ({
      status: 200,
      body: { statementHandle: 'H3', resultSetMetaData: { numRows: 2, rowType: [{ name: 'name', type: 'text' }, { name: 'type', type: 'text' }, { name: 'null?', type: 'text' }] }, data: [['ID', 'NUMBER(38,0)', 'N'], ['NAME', 'VARCHAR(100)', 'Y']] },
    }));
    const a = new SnowflakeAdapter(cfg, { database: 'UTL_AI_PLATFORM', fetch, privateKeyPem: pem });
    expect(await a.describe('CONFORMED_GOLD.DIM_CUSTOMER')).toEqual([
      { name: 'ID', type: 'NUMBER(38,0)', nullable: false },
      { name: 'NAME', type: 'VARCHAR(100)', nullable: true },
    ]);
    expect(calls[0]?.body?.statement).toBe('DESCRIBE TABLE UTL_AI_PLATFORM.CONFORMED_GOLD.DIM_CUSTOMER');
    await expect(a.describe('X; DROP TABLE Y')).rejects.toBeInstanceOf(SnowflakeError);
  });

  it('reuses the JWT until it nears expiry', async () => {
    let now = 1_800_000_000_000;
    const { fetch, calls } = mockApi(() => ({ status: 200, body: { statementHandle: 'h', resultSetMetaData: { numRows: 0, rowType: [] }, data: [] } }));
    const a = new SnowflakeAdapter(cfg, { database: 'D', fetch, privateKeyPem: pem, nowMs: () => now });
    await a.query('SELECT 1');
    await a.query('SELECT 2');
    now += 59 * 60 * 1000;
    await a.query('SELECT 3');
    const tokens = calls.map((c) => c.headers.Authorization);
    expect(tokens[0]).toBe(tokens[1]);
    expect(tokens[2]).not.toBe(tokens[1]);
  });

  it('helpers: account identifiers, bindings, null cells', () => {
    expect(jwtAccount('myorg-myacct')).toBe('MYORG-MYACCT');
    expect(jwtAccount('myorg-myacct.privatelink')).toBe('MYORG-MYACCT');
    expect(binding(null)).toEqual({ type: 'TEXT', value: null });
    expect(binding(2.5)).toEqual({ type: 'REAL', value: '2.5' });
    expect(convertCell(null, { name: 'x', type: 'fixed' })).toBeNull();
  });
});
