import type { SemanticView } from '@/lib/packs/schema';

/** Mermaid erDiagram source for a semantic view's logical model. */
export function erDiagram(view: SemanticView): string {
  const name = (alias: string) => view.tables.find((t) => t.alias === alias)?.fqn.split('.')[1] ?? alias;
  const lines = ['erDiagram'];
  for (const t of view.tables) {
    const cols = [...view.dimensions, ...view.time_dimensions, ...view.facts]
      .filter((d) => d.expr.startsWith(`${t.alias}.`) && /^[a-z]\w*\.[a-z_]\w*$/.test(d.expr))
      .map((d) => `    string ${d.name}`);
    lines.push(`  ${t.fqn.split('.')[1]} {`, `    string ${t.pk.split(',')[0]?.trim()} PK`, ...cols, '  }');
  }
  for (const r of view.relationships) lines.push(`  ${name(r.from.split('.')[0] ?? '')} }o--|| ${name(r.to.split('.')[0] ?? '')} : "${r.from.split('.')[1]}"`);
  return lines.join('\n');
}
