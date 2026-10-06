import { copy } from '@/copy/en';

export interface ConstellationProps {
  agents: { id: string; name: string; hue: number; products: string[]; kpis: string[] }[];
  products: { id: string; name: string; certified: boolean }[];
}

/** Agents (top) linked to the products they use (bottom). Static SVG; hover titles list KPI coverage. */
export function Constellation({ agents, products }: ConstellationProps) {
  const w = 760;
  const h = 220;
  const ax = (i: number) => ((i + 0.5) * w) / agents.length;
  const px = (i: number) => ((i + 0.5) * w) / products.length;
  return (
    <figure className="rounded-lg border border-border bg-surface p-4 shadow-sm" aria-labelledby="constellation-h">
      <figcaption id="constellation-h" className="mb-2 text-base font-semibold">
        {copy.home.constellation}
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={agents.map((a) => `${a.name} uses ${a.products.join(', ')}`).join('; ')}>
        {agents.flatMap((a, i) =>
          a.products.map((p) => {
            const j = products.findIndex((x) => x.id === p);
            return j < 0 ? null : <line key={`${a.id}-${p}`} x1={ax(i)} y1={40} x2={px(j)} y2={180} stroke={`hsl(${a.hue} 60% 50%)`} strokeOpacity={0.5} strokeWidth={1.5} />;
          }),
        )}
        {agents.map((a, i) => (
          <g key={a.id}>
            <title>{`${a.name}: ${a.kpis.join(', ')}`}</title>
            <circle cx={ax(i)} cy={40} r={14} fill={`hsl(${a.hue} 60% 45%)`} />
            <text x={ax(i)} y={14} textAnchor="middle" fontSize={11} fill="currentColor">
              {a.name}
            </text>
          </g>
        ))}
        {products.map((p, j) => (
          <g key={p.id}>
            <title>{p.name}</title>
            <rect x={px(j) - 10} y={170} width={20} height={20} rx={4} fill={p.certified ? 'var(--color-certified)' : 'var(--color-in-certification)'} />
            <text x={px(j)} y={208} textAnchor="middle" fontSize={10} fill="currentColor">
              {p.id.split('-').pop()}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
