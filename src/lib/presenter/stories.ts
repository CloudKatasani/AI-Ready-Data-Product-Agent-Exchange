/**
 * Story engine (09 §1–2): the six shared stories resolved for one pack — `{{…}}` placeholders filled from
 * the pack (personas, company, story roles), per-pack cue overrides applied — and each step's `go` turned
 * into a concrete URL that lands in the documented UI state (09 §1 `presenter/apply`). Pure.
 */
import { getStories } from '@/lib/packs/registry';
import type { Pack, Story } from '@/lib/packs/schema';

export type StoryStep = Story['steps'][number];

export interface ResolvedStep extends StoryStep {
  href: string;
  personaId: string;
}

export interface ResolvedStory extends Omit<Story, 'steps'> {
  steps: ResolvedStep[];
}

/** id + display name of a story role in this pack. */
function role(pack: Pack, name: string): { id: string; name: string } | null {
  const r = pack.manifest.story_roles as Record<string, string>;
  const id = r[name];
  if (!id) return null;
  const label =
    pack.products.find((p) => p.id === id)?.name ??
    pack.agents.find((a) => a.id === id)?.name ??
    pack.kpis.find((k) => k.id === id)?.name ??
    pack.incidents.find((i) => i.id === id)?.title ??
    pack.scenarios.find((s) => s.id === id)?.question ??
    id;
  return { id, name: label };
}

/** Fills `{{persona.A.title}}`, `{{company.name}}`, `{{roles.certDemoProduct.id}}` …; unknown placeholders stay visible. */
export function resolveText(pack: Pack, text: string): string {
  return text.replace(/\{\{\s*([a-zA-Z]+)\.([A-Za-z]+)(?:\.([a-zA-Z]+))?\s*\}\}/g, (all, ns: string, a: string, b?: string) => {
    if (ns === 'company') return a === 'name' ? pack.manifest.company.name : a === 'short' ? pack.manifest.company.short : all;
    if (ns === 'persona') {
      const p = pack.personas.find((x) => x.archetype === a);
      const v = p ? (p as unknown as Record<string, unknown>)[b ?? 'name'] : undefined;
      return typeof v === 'string' ? v : all;
    }
    if (ns === 'roles') {
      const r = role(pack, a);
      return r ? (b === 'name' ? r.name : r.id) : all;
    }
    return all;
  });
}

const enc = encodeURIComponent;

/** The URL a step's Go lands on, with its UI state applied (route-specific mapping, then remaining state as query). */
export function goHref(pack: Pack, step: StoryStep): string {
  const id = pack.manifest.id;
  const state = Object.fromEntries(Object.entries(step.go.state).map(([k, v]) => [k, typeof v === 'string' ? resolveText(pack, v) : v]));
  const roles = pack.manifest.story_roles as Record<string, string>;
  const heroView = pack.semantic.find((v) => v.metrics.some((m) => m.name === pack.kpis.find((k) => k.id === roles.knockoutKpi)?.metric)) ?? pack.semantic[0];
  const heroFact = heroView?.tables[0]?.fqn ?? '';
  const q = (o: Record<string, unknown>) => {
    const s = Object.entries(o)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${enc(k)}=${enc(String(v))}`)
      .join('&');
    return s ? `?${s}` : '';
  };
  switch (step.go.route) {
    case 'home':
      return `/${id}/home${q({ mode: state.agentMode, panel: state.panel })}`;
    case 'ask':
      return `/${id}/ask/${pack.manifest.home.heroAgent}${q({ mode: state.agentMode })}`;
    case 'explorer': {
      if (state.layer === 'bronze') return `/${id}/explorer/RAW_BRONZE`;
      const [schema, name] = heroFact.split('.');
      return `/${id}/explorer/${schema}/${name}${q({ tab: state.tab })}`;
    }
    case 'semantic':
      return `/${id}/semantic/${heroView?.name ?? ''}${q({ tab: state.tab })}`;
    case 'studio': {
      const product = typeof state.product === 'string' ? state.product : roles.certDemoProduct;
      if (state.action === 'submit' || state.autopilot !== undefined) return `/${id}/studio`;
      return `/${id}/studio/${product}${state.stage !== undefined ? `/${state.stage}` : ''}`;
    }
    case 'marketplace':
      if (state.view === 'mesh') return `/${id}/marketplace?tab=mesh`;
      return state.product ? `/${id}/marketplace/products/${state.product}` : `/${id}/marketplace`;
    case 'why/knockout':
      return `/${id}/why/knockout${q({ kpi: state.kpi })}`;
    case 'health':
      return `/${id}/health${q({ incident: state.incident })}`;
    case 'impact': {
      const metric = heroView?.metrics.find((m) => m.name === pack.kpis.find((k) => k.id === roles.knockoutKpi)?.metric);
      const column = /[a-z]+\.([a-z_][a-z0-9_]*)/.exec(metric?.expr ?? '')?.[1];
      return `/${id}/impact${q({ object: heroFact, column, change: 'rename' })}`;
    }
    case 'cost-value':
      return `/${id}/cost-value`;
    case 'readiness':
      return `/${id}/readiness${q({ preset: state.preset })}`;
    case 'roadmap':
      return `/${id}/roadmap${q({ preset: state.action === 'generate' ? 'mid' : undefined, view: state.view })}`;
    case 'portfolio':
      if (state.tab === 'triage') {
        const req = pack.demand.requests.find((r) => r.status === 'IN_TRIAGE' || r.status === 'SUBMITTED');
        return req ? `/${id}/request/${req.id}` : `/${id}/request/new`;
      }
      return `/${id}/portfolio${q({ model: state.sort === 'wsjf' ? 'WSJF' : undefined, view: state.view })}`;
    case 'operating-model':
      return `/${id}/operating-model`;
    case 'platform-map':
      return `/${id}/platform-map${q({ replay: state.replay ? 1 : undefined })}`;
    case 'factory':
      return `/${id}/factory`;
    case 'request/new':
      return `/${id}/request/new`;
    case 'audit':
      return `/${id}/audit${q({ actor: state.filter })}`;
    default:
      return `/${id}/${step.go.route}${q(state)}`;
  }
}

/** A story resolved for the pack: cue overrides applied, placeholders filled, Go URLs computed. */
export function resolveStory(pack: Pack, storyId: string): ResolvedStory | null {
  const story = getStories().find((s) => s.id === storyId);
  if (!story) return null;
  return {
    ...story,
    steps: story.steps.map((s) => {
      const o = pack.storyOverrides.find((x) => x.story === story.id && x.step === s.id);
      const persona = pack.personas.find((p) => p.archetype === s.go.persona) ?? pack.personas[0];
      return {
        ...s,
        title: resolveText(pack, s.title),
        say: resolveText(pack, o?.say ?? s.say),
        do: (o?.do ?? s.do).map((d) => resolveText(pack, d)),
        href: goHref(pack, s),
        personaId: persona?.id ?? '',
      };
    }),
  };
}

export function allStories(pack: Pack): ResolvedStory[] {
  return getStories().flatMap((s) => {
    const r = resolveStory(pack, s.id);
    return r ? [r] : [];
  });
}
