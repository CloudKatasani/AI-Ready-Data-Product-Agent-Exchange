import { tokenizeSql, tokenizeYaml, type Tok } from '@/lib/standards/highlight';
import { cn } from '@/lib/utils';

const CLASS: Record<Tok['t'], string> = {
  kw: 'text-[#1d4ed8] dark:text-[#93c5fd] font-semibold',
  str: 'text-[#047857] dark:text-[#6ee7b7]',
  num: 'text-[#b45309] dark:text-[#fcd34d]',
  com: 'text-muted-foreground italic',
  key: 'text-[#6d28d9] dark:text-[#c4b5fd]',
  id: '',
  punc: '',
};

/** Offline syntax-highlighted SQL/YAML block. */
export function CodeBlock({ code, lang = 'sql', className, label }: { code: string; lang?: 'sql' | 'yaml'; className?: string; label?: string }) {
  const toks = lang === 'sql' ? tokenizeSql(code) : tokenizeYaml(code);
  return (
    <pre role={label ? 'region' : undefined} aria-label={label} tabIndex={0} className={cn('overflow-x-auto rounded-md border border-border bg-muted p-4 font-mono text-[13px] leading-relaxed', className)}>
      <code>
        {toks.map((t, i) => (
          <span key={i} className={CLASS[t.t]}>
            {t.v}
          </span>
        ))}
      </code>
    </pre>
  );
}
