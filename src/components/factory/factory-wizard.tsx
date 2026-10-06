'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { copy } from '@/copy/en';
import type { FactoryAgent, InstructionKind } from '@/lib/agents/factory';
import { cn } from '@/lib/utils';
import { EvalPanel, GatePanel, ReleasePanel, type Result, type SuiteRow } from './panels';

const f = copy.factory;
const KINDS: InstructionKind[] = ['persona', 'response', 'guardrail', 'orchestration'];

export interface WizardProps {
  packId: string;
  agentId: string;
  initial: FactoryAgent;
  status: string;
  version: number;
  products: { id: string; name: string; certified: boolean }[];
  kpis: { id: string; name: string; products: string[] }[];
  suites: SuiteRow[] | null;
  failing: { suite: string; question: string; reason: string | null }[];
  checks: { n: number; label: string; passed: boolean; detail: string; fix: string }[] | null;
  save: (agent: FactoryAgent) => Promise<Result>;
  design: (agent: FactoryAgent, kpiIds: string[]) => Promise<Result & { agent?: FactoryAgent }>;
  evaluate: () => Promise<Result>;
  gate: () => Promise<Result>;
  release: (step: 'pilot' | 'canary' | 'production' | 'rollback', rationale: string) => Promise<Result>;
}

const input = 'h-9 rounded-md border border-border bg-background px-2';
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

/** Agent Factory (01 §M7): 7 steps; the engines see the draft as soon as it is saved. */
export function FactoryWizard(p: WizardProps) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<FactoryAgent>(p.initial);
  const [kpiIds, setKpiIds] = useState<string[]>(p.initial.manifest.kpi_coverage.map((c) => c.kpi));
  const [note, setNote] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const m = a.manifest;
  const setM = (patch: Partial<FactoryAgent['manifest']>) => setA((x) => ({ ...x, manifest: { ...x.manifest, ...patch } }));
  const chosen = new Set(m.products.map((x) => x.id));
  const persist = () => start(async () => setNote(await p.save(a)));

  return (
    <div className="flex flex-col gap-4" data-testid="factory-wizard">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Steps">
        {f.steps.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={cn('min-h-[24px] rounded-full border px-3 py-1', i === step ? 'border-primary font-semibold' : 'border-border text-muted-foreground')} data-step={i + 1}>
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>
      <div className="rounded-lg border border-border bg-surface p-4">
        {step === 0 && (
          <div className="grid max-w-2xl gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {f.name}
              <input className={input} value={m.name} onChange={(e) => setM({ name: e.target.value })} data-testid="agent-name" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {f.capability}
              <input className={input} value={m.capability} onChange={(e) => setM({ capability: e.target.value })} data-testid="agent-capability" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {f.personaServed}
              <input className={input} value={m.personas_served.join(', ')} onChange={(e) => setM({ personas_served: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </label>
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <fieldset className="flex flex-col gap-1.5 text-sm">
              <legend className="mb-1 font-medium">{f.products}</legend>
              {p.products.map((x) => (
                <label key={x.id} className={cn('inline-flex min-h-[24px] items-center gap-2', !x.certified && 'text-muted-foreground')}>
                  <input type="checkbox" disabled={!x.certified && !chosen.has(x.id)} checked={chosen.has(x.id)} onChange={(e) => setM({ products: e.target.checked ? [...m.products, { id: x.id, columns: '*' }] : m.products.filter((b) => b.id !== x.id) })} data-product={x.id} />
                  {x.name} {!x.certified && <span className="text-xs">({f.notCertified})</span>}
                </label>
              ))}
            </fieldset>
            <fieldset className="flex flex-col gap-1.5 text-sm">
              <legend className="mb-1 font-medium">{f.kpis}</legend>
              {p.kpis
                .filter((k) => k.products.some((x) => chosen.has(x)))
                .map((k) => (
                  <label key={k.id} className="inline-flex min-h-[24px] items-center gap-2">
                    <input type="checkbox" checked={kpiIds.includes(k.id)} onChange={(e) => setKpiIds((ids) => (e.target.checked ? [...ids, k.id] : ids.filter((i) => i !== k.id)))} data-kpi={k.id} />
                    {k.name}
                    {m.kpi_coverage.find((c) => c.kpi === k.id) && (
                      <span className="text-xs text-muted-foreground">
                        {m.kpi_coverage.find((c) => c.kpi === k.id)?.grains.join('/')} · {m.kpi_coverage.find((c) => c.kpi === k.id)?.slices.join(', ')}
                      </span>
                    )}
                  </label>
                ))}
            </fieldset>
          </div>
        )}
        {(step === 1 || step === 2) && (
          <button
            type="button"
            disabled={pending || chosen.size === 0}
            onClick={() =>
              start(async () => {
                const r = await p.design(a, kpiIds);
                if (r.agent) {
                  setA(r.agent);
                  setKpiIds(r.agent.manifest.kpi_coverage.map((c) => c.kpi));
                }
                setNote(r);
              })
            }
            className="mt-3 h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            data-testid="design"
          >
            {f.design}
          </button>
        )}
        {step === 2 && (
          <div className="mt-3 grid gap-3">
            {KINDS.map((k) => (
              <label key={k} className="flex flex-col gap-1 text-sm">
                {f.instruction[k]}
                <textarea rows={3} className="rounded-md border border-border bg-background p-2" value={a.instructions[k]} onChange={(e) => setA((x) => ({ ...x, instructions: { ...x.instructions, [k]: e.target.value } }))} data-testid={`instruction-${k}`} />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-sm">
              {f.outOfScope}
              <textarea rows={3} className="rounded-md border border-border bg-background p-2" value={m.out_of_scope.join('\n')} onChange={(e) => setM({ out_of_scope: lines(e.target.value) })} />
            </label>
          </div>
        )}
        {step === 3 && (
          <div className="grid max-w-xl gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              {f.cost}
              <input type="number" step="0.01" className={input} value={m.budgets.cost_per_answer_usd} onChange={(e) => setM({ budgets: { ...m.budgets, cost_per_answer_usd: Number(e.target.value) } })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {f.latency}
              <input type="number" className={input} value={m.budgets.p95_latency_ms} onChange={(e) => setM({ budgets: { ...m.budgets, p95_latency_ms: Number(e.target.value) } })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {f.rounds}
              <input type="number" className={input} value={m.budgets.max_tool_rounds} onChange={(e) => setM({ budgets: { ...m.budgets, max_tool_rounds: Number(e.target.value) } })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {f.onCall}
              <input className={input} value={m.on_call} onChange={(e) => setM({ on_call: e.target.value })} />
            </label>
          </div>
        )}
        {step === 4 && <EvalPanel suites={p.suites} failing={p.failing} run={p.evaluate} />}
        {step === 5 && <GatePanel checks={p.checks} run={p.gate} />}
        {step === 6 && (
          <div className="flex flex-col gap-3">
            <ReleasePanel status={p.status} act={p.release} />
            {p.status !== 'DRAFT' && (
              <Link href={`/${p.packId}/ask/${p.agentId}`} className="text-primary underline">
                {f.openAsk}
              </Link>
            )}
          </div>
        )}
        {step <= 3 && (
          <button type="button" disabled={pending} onClick={persist} className="mt-4 h-9 rounded-md border border-primary px-4 text-sm font-medium" data-testid="save-agent">
            {f.save}
          </button>
        )}
        {note && (
          <p role="status" className="mt-3 text-sm" data-testid="factory-note">
            {note.message}
          </p>
        )}
      </div>
    </div>
  );
}
