/** Renders an artifact field value (text, list, number, table rows). */
export function FieldValueView({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">—</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">—</span>;
    if (typeof value[0] === 'object' && value[0] !== null) {
      const cols = Object.keys(value[0] as object);
      return (
        <div role="region" aria-label="Table value" tabIndex={0} className="max-h-64 overflow-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                {cols.map((c) => (
                  <th key={c} scope="col" className="px-2 py-1 text-left font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(value as Record<string, unknown>[]).slice(0, 40).map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {cols.map((c) => (
                    <td key={c} className="px-2 py-1 align-top">
                      {String(r[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <ul className="list-disc pl-5">
        {(value as unknown[]).slice(0, 40).map((v, i) => (
          <li key={i} className="break-words">
            {String(v)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') return <code className="text-xs">{JSON.stringify(value)}</code>;
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

/** Text form of a value for editing; parsed back by `parseFieldText`. */
export function fieldText(kind: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (kind === 'list') return (Array.isArray(value) ? value : [value]).map(String).join('\n');
  if (kind === 'table') return JSON.stringify(value ?? [], null, 2);
  return String(value);
}

export function parseFieldText(kind: string, text: string): unknown {
  if (kind === 'list') return text.split('\n').map((x) => x.trim()).filter(Boolean);
  if (kind === 'number') return text.trim() === '' ? null : Number(text);
  if (kind === 'table') {
    try {
      const v = JSON.parse(text || '[]') as unknown;
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return text;
}
