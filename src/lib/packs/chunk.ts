/** Splits a document into ~600-character chunks on paragraph boundaries (05 §7). */
export function chunkDocument(body: string, target = 600): string[] {
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > target) {
      chunks.push(cur);
      cur = p;
    } else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** Masking macros plus `GOVERNANCE.as_of()` — the pack clock for SQL (Silver/Gold never read the wall clock). */
