import { EyeOff } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { CodeBlock } from '@/components/ui/code-block';
import { copy } from '@/copy/en';
import { productObjects } from '@/lib/lifecycle/quality';
import { describeObject } from '@/lib/presenter/governed';
import { maskFor } from '@/lib/query/policies';
import { type ContractColumn, odcsContract, odcsYaml } from '@/lib/standards/odcs';
import type { TabProps } from '.';

export async function contractColumns(packId: string, objects: string[]): Promise<Record<string, ContractColumn[]>> {
  const out: Record<string, ContractColumn[]> = {};
  for (const fqn of objects) out[fqn] = await describeObject(packId, fqn);
  return out;
}

export async function ContractTab({ pack, product, card }: TabProps) {
  const objects = productObjects(pack, product).filter((o) => !o.startsWith('RAW_BRONZE.'));
  const yaml = odcsYaml(odcsContract(pack, product, card.version, card.status, await contractColumns(pack.manifest.id, objects)));
  return (
    <div className="flex flex-col gap-3">
      <a href={`/api/contract?pack=${pack.manifest.id}&product=${product.id}`} className={`${buttonVariants({ variant: 'outline', size: 'sm' })} self-start`} download>
        {copy.product.downloadContract}
      </a>
      <CodeBlock code={yaml} lang="yaml" label="ODCS data contract" className="max-h-[36rem]" />
    </div>
  );
}

export async function SchemaTab({ pack, product, who }: TabProps) {
  const objects = productObjects(pack, product).filter((o) => !o.startsWith('RAW_BRONZE.'));
  const cols = await contractColumns(pack.manifest.id, objects);
  const tags = new Map(pack.policies.column_tags.map((t) => [t.column, t]));
  const terms = new Map(pack.glossary.flatMap((t) => t.mappings.columns.map((c) => [c, t] as const)));
  return (
    <div className="flex flex-col gap-6">
      {objects.map((fqn) => (
        <section key={fqn}>
          <h2 className="mb-2 font-mono text-sm font-semibold">
            <Link href={`/${pack.manifest.id}/explorer/${fqn.replace('.', '/')}`} className="text-primary underline">
              {fqn}
            </Link>
          </h2>
          <div role="region" aria-label={fqn} tabIndex={0} className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {[copy.product.column, copy.product.type, copy.product.tags, copy.product.term, copy.product.maskingForYou].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(cols[fqn] ?? []).map((c) => {
                  const col = `${fqn}.${c.name}`;
                  const tag = tags.get(col);
                  const term = terms.get(col);
                  const mask = maskFor(pack, who, col);
                  return (
                    <tr key={c.name} className="border-t border-border">
                      <td className="px-3 py-1.5 font-mono">{c.name}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{c.type}</td>
                      <td className="px-3 py-1.5 text-xs">{[...(tag?.classes ?? []), ...(tag?.cde ? ['CDE'] : [])].join(', ')}</td>
                      <td className="px-3 py-1.5">
                        {term && (
                          <Link href={`/${pack.manifest.id}/glossary/${term.id}`} className="text-primary underline">
                            {term.name}
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {mask ? (
                          <span className="inline-flex items-center gap-1">
                            <EyeOff aria-hidden className="size-3.5 text-degraded" />
                            {mask.policyId}
                          </span>
                        ) : tag?.classes?.length ? (
                          copy.product.clear
                        ) : (
                          ''
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
