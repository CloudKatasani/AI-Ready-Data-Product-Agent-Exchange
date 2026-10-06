'use client';

import { ResultChart } from '@/components/charts/result-chart';
import { DataGrid } from '@/components/ui/data-grid';
import { copy } from '@/copy/en';
import type { AgentAnswer } from '@/lib/agents/types';

/** Chart (bar/line auto from the result shape) plus the governed result table; never parsed from text. */
export function AnswerResultView({ answer, locale }: { answer: AgentAnswer; locale: string }) {
  const r = answer.result;
  if (!r || r.rows.length === 0) return null;
  const metricField = r.fields.find((f) => f.role === 'metric');
  const x = r.fields.find((f) => f.role === 'period' || f.role === 'dimension');
  const chartable = (answer.chart.type === 'bar' || answer.chart.type === 'line') && x && metricField && r.rows.length > 1;
  const data = r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c.name, (typeof row[i] === 'boolean' ? String(row[i]) : row[i]) ?? null])));
  const maskPolicy = Object.fromEntries(r.policiesApplied.filter((p) => p.kind === 'masking').map((p) => [p.target.split('.').pop() ?? p.target, p.ruleOrPolicyId ?? 'masking policy']));
  return (
    <div className="flex flex-col gap-3">
      {chartable && <ResultChart kind={answer.chart.type === 'line' ? 'line' : 'bar'} data={data} x={x.name} y={metricField.name} label={answer.headline} unit={metricField.unit} />}
      {(r.rows.length > 1 || r.columns.length > 1) && (
        <DataGrid
          caption={copy.ask.viewTable}
          columns={r.fields.map((f) => ({ name: f.name, label: f.label, unit: f.unit, decimals: f.decimals }))}
          rows={r.rows.slice(0, 50)}
          masked={r.maskedColumns}
          maskPolicy={maskPolicy}
          locale={locale}
        />
      )}
    </div>
  );
}
