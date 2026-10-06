'use server';

import { revalidatePath } from 'next/cache';
import { draftAndBuild } from '@/lib/presenter/drafter';

export interface DraftResult {
  ok: boolean;
  message: string;
  details?: string[];
}

/** Pack Drafter (01 §M13, offline): clone + re-skin a deep pack as a draft, validate it, build its warehouse. */
export async function draftPackAction(_prev: DraftResult | null, form: FormData): Promise<DraftResult> {
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const input = {
    id: s('id'),
    name: s('name') || s('id'),
    code: s('code').toUpperCase(),
    industry: s('industry') || s('name'),
    company: { name: s('company'), short: s('short'), hq: s('hq') || 'Harbourton', description: s('description') || `${s('company')} — draft pack` },
    regions: s('regions') ? s('regions').split(',').map((r) => r.trim()) : [],
  };
  try {
    const r = await draftAndBuild(s('from'), input);
    if (!r.ok) return { ok: false, message: `Drafted ${input.id}, but validation found ${r.errors.length} error(s).`, details: r.errors.slice(0, 8) };
    revalidatePath('/launch');
    return { ok: true, message: `Draft pack ${input.id} created from ${s('from')} — static validation clean, warehouse built. Review every section, run the full validator and approve golden answers before using it in a story.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'The draft could not be created.' };
  }
}
