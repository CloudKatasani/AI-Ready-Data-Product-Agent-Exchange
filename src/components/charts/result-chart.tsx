'use client';

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface ChartProps {
  kind: 'bar' | 'line';
  data: Record<string, string | number | null>[];
  x: string;
  y: string;
  label: string;
  unit?: string;
}

/** Bar (by dimension) or line (over time). The table rendered next to it is the "view as table" alternative. */
export function ResultChart({ kind, data, x, y, label, unit }: ChartProps) {
  const common = { data, margin: { top: 8, right: 16, bottom: 8, left: 8 } };
  return (
    <figure aria-label={label} data-testid="result-chart" className="h-72 w-full rounded-md border border-border bg-surface p-2">
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'line' ? (
          <LineChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey={x} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit={unit === '%' ? '%' : undefined} />
            <Tooltip />
            <Line type="monotone" dataKey={y} stroke="var(--brand-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        ) : (
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey={x} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit={unit === '%' ? '%' : undefined} />
            <Tooltip />
            <Bar dataKey={y} fill="var(--brand-primary)" isAnimationActive={false} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </figure>
  );
}
