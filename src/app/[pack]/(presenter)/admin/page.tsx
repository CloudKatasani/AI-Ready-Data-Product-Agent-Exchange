import { copy } from '@/copy/en';
import { getEnv, hasApiKey } from '@/lib/config/env';
import { getPack, getRubrics, listPackIds } from '@/lib/packs/registry';
import type { Pack } from '@/lib/packs/schema';
import { DrafterForm } from '@/components/presenter/drafter-form';
import { listSnapshots } from '@/lib/presenter/reset';
import { draftPackAction } from './actions';
import { activePersona } from '../../_server/session';

const c = copy.admin;

/** Admin (01 §M12): read-only operational view. The API key is shown as present/absent only (I11). */
export default async function AdminPage({ params }: { params: Promise<{ pack: string }> }) {
  const { pack: packId } = await params;
  const pack = getPack(packId);
  const persona = await activePersona(pack);
  const env = getEnv();
  const rubrics = getRubrics();
  const packs = listPackIds().flatMap((id): Pack[] => {
    try {
      return [getPack(id)];
    } catch {
      return [];
    }
  });
  const snaps = listSnapshots();
  const row = (k: string, v: string | number) => (
    <div key={k} className="flex justify-between gap-4 border-t border-border py-1 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
        {persona.archetype !== 'D' && <p className="text-sm text-degraded">{c.restricted}</p>}
      </header>
      <section aria-labelledby="packs-h">
        <h2 id="packs-h" className="mb-2 font-semibold">{c.packs}</h2>
        <table className="w-full text-sm" data-testid="admin-packs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th scope="col">{c.pack}</th>
              <th scope="col">{c.version}</th>
              <th scope="col">{c.depth}</th>
              <th scope="col">{c.contents}</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => (
              <tr key={p.manifest.id} className="border-t border-border">
                <th scope="row" className="py-1 text-left font-normal">
                  {p.manifest.id} · {p.manifest.company.name}
                </th>
                <td>{p.manifest.version}</td>
                <td>{p.manifest.depth}</td>
                <td>
                  {p.products.length} products · {p.agents.length} agents · {p.kpis.length} KPIs · {p.scenarios.length} scenarios
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="agents-h">
          <h2 id="agents-h" className="mb-2 font-semibold">{c.agents}</h2>
          <dl data-testid="admin-agents">
            {row(c.defaultMode, env.AGENT_MODE_DEFAULT)}
            {row(c.key, hasApiKey(env) ? c.present : c.absent)}
            {row(c.model('answer'), env.KEYSTONE_MODEL_ANSWER ?? c.notSet)}
            {row(c.model('lifecycle'), env.KEYSTONE_MODEL_LIFECYCLE ?? c.notSet)}
            {row(c.model('fast'), env.KEYSTONE_MODEL_FAST ?? c.notSet)}
            {row(c.timeout, env.LLM_TIMEOUT_MS)}
            {row(c.rounds, env.LLM_MAX_TOOL_ROUNDS)}
            {row(c.sessionBudget, env.LLM_BUDGET_USD_PER_SESSION)}
            {row(c.scale, env.DEMO_SCALE)}
          </dl>
        </section>
        <section aria-labelledby="rubrics-h">
          <h2 id="rubrics-h" className="mb-2 font-semibold">{c.rubrics}</h2>
          <dl>
            {row('Certification quality minimum', JSON.stringify(rubrics.certification).slice(0, 80))}
            {row('Matcher run / clarify', `${rubrics.matcher.run_threshold} / ${rubrics.matcher.clarify_threshold}`)}
            {row('Grounding tolerance', rubrics.grounding.derived_value_tolerance_rel)}
            {row('Readiness target', rubrics.readiness.target)}
            {row('Breaking-change notice (days)', rubrics.contracts.breaking_notice_days)}
            {row('Reset target (ms)', rubrics.demo.reset_target_ms)}
          </dl>
        </section>
      </div>
      <section aria-labelledby="drafter-h" className="flex flex-col gap-2">
        <h2 id="drafter-h" className="font-semibold">{c.drafter.title}</h2>
        <p className="text-sm text-muted-foreground">{c.drafter.intro}</p>
        <DrafterForm action={draftPackAction} sources={packs.filter((p) => p.manifest.depth === 'deep').map((p) => ({ id: p.manifest.id, name: `${p.manifest.name} · ${p.manifest.company.name}` }))} />
        <p className="text-xs text-muted-foreground">{c.drafter.liveNote}</p>
      </section>
      <section aria-labelledby="snaps-h">
        <h2 id="snaps-h" className="mb-2 font-semibold">{c.snapshots}</h2>
        {snaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{c.none}</p>
        ) : (
          <ul className="text-sm" data-testid="admin-snapshots">
            {snaps.map((s) => (
              <li key={s.key}>
                {s.key} · {(s.bytes / 1024).toFixed(0)} KB · {s.at.slice(0, 16).replace('T', ' ')}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
