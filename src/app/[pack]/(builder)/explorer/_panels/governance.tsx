import { Badge } from '@/components/ui/badge';
import { copy } from '@/copy/en';
import type { Pack } from '@/lib/packs/schema';
import { accessHistory } from '@/lib/presenter/governed';
import { productsForObject } from '@/lib/query/policies';

export async function GovernancePanel({ pack, fqn }: { pack: Pack; fqn: string }) {
  const products = productsForObject(pack, fqn);
  const tags = pack.policies.column_tags.filter((t) => t.column.startsWith(`${fqn}.`));
  const raps = pack.policies.row_access_policies.filter((r) => r.bindings.some((b) => b.object === fqn));
  const grants = pack.policies.grants.filter((g) => g.products.some((p) => products.includes(p)));
  const history = await accessHistory(fqn);
  const personaName = (id: string) => pack.personas.find((p) => p.id === id)?.name ?? id;
  return (
    <div className="grid gap-6 text-sm md:grid-cols-2" data-testid="governance">
      <section>
        <h3 className="mb-2 font-semibold">{copy.explorer.products}</h3>
        <ul className="flex flex-wrap gap-2">
          {products.map((p) => (
            <li key={p}>
              <Badge variant="outline">
                {p} · {pack.products.find((x) => x.id === p)?.name}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">{copy.explorer.policies}</h3>
        <ul className="flex flex-col gap-1">
          {raps.map((r) => (
            <li key={r.id}>
              <span className="font-mono">{r.id}</span> — {r.description}
            </li>
          ))}
          {tags
            .filter((t) => t.masking)
            .map((t) => (
              <li key={t.column}>
                <span className="font-mono">{t.masking}</span> on {t.column.split('.').pop()} {t.mask_pending_fix ? `(${copy.explorer.pendingFix}: ${t.mask_pending_fix})` : ''}
              </li>
            ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">{copy.explorer.grants}</h3>
        <ul className="flex flex-col gap-1">
          {grants.map((g) => (
            <li key={g.persona}>{personaName(g.persona)}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">{copy.explorer.history}</h3>
        {history.length === 0 ? (
          <p className="text-muted-foreground">{copy.explorer.noHistory}</p>
        ) : (
          <table className="w-full">
            <thead className="text-left">
              <tr>
                <th scope="col">{copy.explorer.persona}</th>
                <th scope="col">{copy.explorer.purpose}</th>
                <th scope="col">{copy.explorer.rows}</th>
                <th scope="col">{copy.explorer.when}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{personaName(h.personaId)}</td>
                  <td>{h.purpose ?? h.kind}</td>
                  <td>{h.rowCount}</td>
                  <td className="font-mono text-xs">{h.createdAt.replace('T', ' ').slice(0, 19)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
