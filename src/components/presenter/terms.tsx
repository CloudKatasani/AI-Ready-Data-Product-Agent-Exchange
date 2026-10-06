'use client';

import { useEffect } from 'react';

/**
 * Display-only terminology overrides (09 §4): whole-word replacements of pack display strings (e.g. region
 * names) inside the page, re-applied as content changes. IDs, data and queries are untouched; elements
 * marked `data-no-terms` (form inputs are never touched) keep the original text.
 */
export function TerminologyOverrides({ terms }: { terms: Record<string, string> }) {
  useEffect(() => {
    const entries = Object.entries(terms).filter(([from, to]) => from && to && from !== to);
    if (!entries.length) return;
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b(${entries.map(([f]) => esc(f)).sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');
    const map = new Map(entries);
    const root = document.getElementById('main');
    if (!root) return;
    // Text this component wrote: never re-processed, so a replacement containing its source word cannot loop.
    const written = new WeakMap<Node, string>();
    const apply = (node: Node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => ((n.parentElement?.closest('[data-no-terms], script, style, textarea') ?? null) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const v = n.nodeValue ?? '';
        if (written.get(n) === v) continue;
        re.lastIndex = 0;
        if (!re.test(v)) continue;
        const out = v.replace(re, (m) => map.get(m) ?? m);
        written.set(n, out);
        n.nodeValue = out;
      }
    };
    apply(root);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') apply(m.target);
        m.addedNodes.forEach(apply);
      }
    });
    obs.observe(root, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, [terms]);
  return null;
}
