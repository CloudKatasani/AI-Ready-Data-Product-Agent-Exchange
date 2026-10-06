'use client';

import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';

/** Readiness radar: one polygon per series over the seven dimensions (the table beside it is the text alternative). */
export function ReadinessRadar({ data, series, label }: { data: Record<string, string | number | null>[]; series: { key: string; name: string; dashed?: boolean }[]; label: string }) {
  return (
    <figure aria-label={label} data-testid="readiness-radar" className="h-80 w-full rounded-md border border-border bg-surface p-2">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 10 }} />
          {series.map((s, i) => (
            <Radar key={s.key} name={s.name} dataKey={s.key} stroke={i === 0 ? 'var(--brand-primary)' : 'var(--brand-accent)'} fill={i === 0 ? 'var(--brand-primary)' : 'transparent'} fillOpacity={0.25} strokeDasharray={s.dashed ? '4 4' : undefined} isAnimationActive={false} />
          ))}
          <Tooltip />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </figure>
  );
}
