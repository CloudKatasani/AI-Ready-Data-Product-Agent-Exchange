/** Minimal SQL / YAML tokenizers for offline syntax highlighting (ported from AI-Ready `ddl.ts`). */
const SQL_KW = new Set(
  ('SELECT FROM WHERE AND OR NOT AS ON JOIN LEFT RIGHT INNER OUTER GROUP BY ORDER LIMIT HAVING CREATE REPLACE TABLE VIEW SECURE ' +
    'DYNAMIC ICEBERG SEMANTIC CORTEX SEARCH SERVICE AGENT WITH TAG MASKING POLICY ROW ACCESS COMMENT TARGET_LAG WAREHOUSE ' +
    'CASE WHEN THEN ELSE END SUM COUNT AVG MIN MAX DISTINCT QUALIFY OVER PARTITION ROW_NUMBER DESC ASC IN IS NULL TRUE FALSE ' +
    'BETWEEN DATE_TRUNC DATEADD CURRENT_DATE TABLES RELATIONSHIPS FACTS DIMENSIONS METRICS PRIMARY KEY REFERENCES SYNONYMS ' +
    'STREAM RETURNS USING REFRESH_MODE INCREMENTAL CATALOG EXTERNAL_VOLUME BASE_LOCATION TIME_DIMENSIONS ATTRIBUTES ' +
    'APPEND_ONLY ROUND NULLIF IFF COALESCE YEAR QUARTER MONTH DAY WEEK INTERVAL WITHIN PERCENTILE_CONT COUNT_IF CAST ' +
    'VARCHAR NUMBER DATE TIMESTAMP TIMESTAMP_NTZ BOOLEAN FLOAT DOUBLE INTEGER BIGINT UNION ALL LIKE ILIKE').split(' '),
);

export type Tok = { t: 'kw' | 'str' | 'num' | 'com' | 'id' | 'punc' | 'key'; v: string };

export function tokenizeSql(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_$.]*)|(\s+)|([^\sA-Za-z0-9_'])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[1]) out.push({ t: 'com', v: m[1] });
    else if (m[2]) out.push({ t: 'str', v: m[2] });
    else if (m[3]) out.push({ t: 'num', v: m[3] });
    else if (m[4]) out.push({ t: SQL_KW.has(m[4].toUpperCase()) ? 'kw' : 'id', v: m[4] });
    else out.push({ t: 'punc', v: m[0] });
  }
  return out;
}

export function tokenizeYaml(src: string): Tok[] {
  const out: Tok[] = [];
  for (const line of src.split('\n')) {
    const m = /^(\s*-?\s*)([A-Za-z_][\w-]*)(:)(.*)$/.exec(line);
    if (m) {
      out.push({ t: 'punc', v: m[1] ?? '' }, { t: 'key', v: m[2] ?? '' }, { t: 'punc', v: m[3] ?? '' });
      const rest = m[4] ?? '';
      if (/^\s*#/.test(rest)) out.push({ t: 'com', v: rest });
      else if (/^\s*(true|false|\d+(\.\d+)?)\s*$/.test(rest)) out.push({ t: 'num', v: rest });
      else out.push({ t: 'str', v: rest });
    } else if (/^\s*#/.test(line)) out.push({ t: 'com', v: line });
    else out.push({ t: 'id', v: line });
    out.push({ t: 'punc', v: '\n' });
  }
  out.pop();
  return out;
}
