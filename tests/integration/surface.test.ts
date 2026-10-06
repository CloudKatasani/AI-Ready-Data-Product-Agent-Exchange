import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Exercises the library surface that otherwise runs only in test setup, scripts or the browser suites:
 * a full lifecycle seed into a fresh DB, the validator's warehouse / metric / scenario categories,
 * standards exports (ODCS, OpenLineage, semantic-view YAML, DDL), the evidence pack and audit bundle,
 * Studio, Autopilot, demand, the coverage heatmap and the readiness probe.
 */
const URL = 'file:../data/test-surface.db';
for (const f of ['test-surface.db', 'test-surface.db-journal']) rmSync(join(process.cwd(), 'data', f), { force: true });
execSync('pnpm exec prisma migrate deploy', { env: { ...process.env, DATABASE_URL: URL }, stdio: 'ignore' });
process.env.DATABASE_URL = URL;

const PACK = 'utilities';

describe('library surface on a freshly seeded DB', async () => {
  const { db } = await import('@/lib/db');
  const { getPack, getRubrics } = await import('@/lib/packs/registry');
  const { seedPack } = await import('@/lib/presenter/seed');
  const { QueryService } = await import('@/lib/query/query-service');
  const { testWarehouse } = await import('../setup/query');
  const pack = getPack(PACK);
  const rubrics = getRubrics();
  const warehouse = await testWarehouse();
  const qs = new QueryService({ pack, rubrics, warehouse, log: { write: async () => 'surface' } });
  const prisma = db();

  it('seeds a pack through the real lifecycle', async () => {
    const r = await seedPack(prisma, pack, { rubrics, qs });
    expect(r.products).toBe(pack.products.length);
    expect(r.gates).toBeGreaterThan(0);
    const certified = await prisma.dataProduct.count({ where: { packId: PACK, status: 'CERTIFIED' } });
    expect(certified).toBe(pack.products.filter((p) => p.initial_status === 'CERTIFIED').length);
  });

  it('validator categories 4, 7 and 8 pass against the built warehouse', async () => {
    const { warehouseChecks } = await import('@/lib/warehouse/validate');
    const { metricChecks } = await import('@/lib/query/validate');
    const { scenarioChecks } = await import('@/lib/agents/validate');
    let results = await warehouseChecks(pack, warehouse);
    results = await metricChecks(pack, rubrics, warehouse, results);
    results = await scenarioChecks(pack, rubrics, qs, results);
    expect(results.length).toBeGreaterThan(100);
    expect(results.filter((r) => !r.ok && r.severity === 'error').map((r) => r.message)).toEqual([]);
  });

  it('standards exports: ODCS contract, OpenLineage, semantic-view YAML, DDL and highlighting', async () => {
    const { odcsContract, odcsYaml } = await import('@/lib/standards/odcs');
    const { openLineage } = await import('@/lib/standards/openlineage');
    const { semanticViewYaml } = await import('@/lib/standards/semantic-view-yaml');
    const { buildStatement, renderDdl } = await import('@/lib/standards/ddl');
    const { tokenizeSql, tokenizeYaml } = await import('@/lib/standards/highlight');
    const product = pack.products.find((p) => p.initial_status === 'CERTIFIED');
    if (!product) throw new Error('no certified product');
    const view = pack.semantic.find((v) => v.name === product.semantic_view);
    const fact = view?.tables[0]?.fqn ?? '';
    const cols = (await warehouse.describe(fact)).map((c) => ({ name: c.name, type: c.type, nullable: true }));
    const yaml = odcsYaml(odcsContract(pack, product, product.version, 'CERTIFIED', { [fact]: cols }));
    expect(yaml).toContain('apiVersion');
    expect(openLineage(pack, product.id).length).toBeGreaterThan(0);
    const svy = semanticViewYaml(pack, view ?? pack.semantic[0]!);
    expect(svy).toContain('metrics');
    expect(tokenizeYaml(svy).length).toBeGreaterThan(10);
    expect(buildStatement(pack, fact)).toMatch(/SELECT/i);
    const ddl = renderDdl(pack, fact, cols);
    expect(ddl).toContain(pack.manifest.database);
    expect(tokenizeSql(ddl).some((t) => t.t === 'kw')).toBe(true);
    const bronze = pack.sources[0]?.name ?? '';
    expect(renderDdl(pack, `RAW_BRONZE.${bronze}`, cols.slice(0, 2))).toContain('ICEBERG');
  });

  it('evidence pack (docx) and audit bundle (zip) round-trip', async () => {
    const { evidencePack } = await import('@/lib/exports/evidence-pack');
    const { auditBundle } = await import('@/lib/exports/audit-bundle');
    const { unzip, crc32 } = await import('@/lib/exports/zip');
    const product = pack.products.find((p) => p.initial_status === 'CERTIFIED');
    const doc = await evidencePack(prisma, pack, product?.id ?? '');
    const parts = unzip(doc).map((e) => e.name);
    expect(parts).toContain('word/document.xml');
    const bundle = await auditBundle(prisma, PACK);
    expect(bundle.ok).toBe(true);
    expect(bundle.events).toBeGreaterThan(0);
    expect(unzip(bundle.zip).length).toBeGreaterThan(0);
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('Studio board, workspace and an Autopilot run on the lifecycle demo product', async () => {
    const { studioBoard, studioWorkspace } = await import('@/lib/presenter/studio');
    const { startAutopilot, stepAutopilot, cancelAutopilot } = await import('@/lib/lifecycle/autopilot');
    const board = await studioBoard(pack);
    expect(board.length).toBe(pack.products.length);
    const demo = pack.manifest.story_roles.lifecycleDemoProduct;
    const ws = await studioWorkspace(pack, rubrics, demo);
    expect(ws).not.toBeNull();
    const owner = pack.personas.find((p) => p.archetype === 'C')?.id ?? '';
    const runId = await startAutopilot(prisma, demo, owner);
    const first = await stepAutopilot(prisma, pack, rubrics, runId, qs);
    expect(['RUNNING', 'AWAITING_REVIEW', 'AWAITING_GATE', 'COMPLETED']).toContain(first.state);
    await cancelAutopilot(prisma, runId);
    const run = await prisma.autopilotRun.findUnique({ where: { id: runId } });
    expect(run?.state).toBe('CANCELLED');
  });

  it('demand: submitting counts as a vote; one vote per persona', async () => {
    const { listDemand, submitDemand, voteDemand } = await import('@/lib/marketplace/demand');
    const who = pack.personas.find((p) => p.archetype === 'B')?.id ?? '';
    const { id } = await submitDemand(prisma, pack, who, { kind: 'PRODUCT', title: 'Surface test request', description: 'Exercises the demand board.' });
    const other = pack.personas.find((p) => p.archetype === 'A')?.id ?? '';
    expect(await voteDemand(prisma, PACK, id, who)).toBe(false); // the submitter's vote is counted on submit
    expect(await voteDemand(prisma, PACK, id, other)).toBe(true);
    expect(await voteDemand(prisma, PACK, id, other)).toBe(false);
    expect((await listDemand(prisma, PACK, who)).some((d) => d.id === id)).toBe(true);
  });

  it('coverage heatmap: levels, histogram and Simulate +4 weeks never regress', async () => {
    const { coverage, levelHistogram, simulate } = await import('@/lib/strategy/coverage');
    const rows = coverage(pack, (id) => pack.products.find((p) => p.id === id)?.initial_status ?? 'DRAFT');
    expect(rows.length).toBe(pack.sources.length);
    expect(levelHistogram(rows).reduce((a, b) => a + b, 0)).toBe(rows.length);
    const sim = simulate(rows, 4, 1);
    sim.rows.forEach((r, i) => expect(r.levelNow).toBeGreaterThanOrEqual(rows[i]?.levelNow ?? 0));
  });

  it('readiness probe reports the DB and packs', async () => {
    const { readinessChecks } = await import('@/lib/presenter/readiness-check');
    const checks = await readinessChecks();
    expect(checks.length).toBeGreaterThan(2);
  });
});
