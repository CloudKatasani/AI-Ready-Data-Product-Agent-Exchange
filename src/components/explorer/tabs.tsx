import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Link-based tabs (server-rendered, shareable URLs, keyboard reachable). */
export function LinkTabs({ tabs, active, label }: { tabs: { id: string; label: string; href: string }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === active ? 'page' : undefined}
          data-tab={t.id}
          className={cn('-mb-px border-b-2 px-3 py-2 text-sm', t.id === active ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
