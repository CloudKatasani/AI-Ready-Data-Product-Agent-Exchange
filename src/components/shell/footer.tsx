import { copy } from '@/copy/en';

/** Invariant I10: every screen states that the data is synthetic. `asOf` comes from the pack clock (Phase 1). */
export function Footer({ asOf }: { asOf?: string }) {
  return (
    <footer data-testid="synthetic-footer" className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
      {copy.shell.footer}
      {asOf ? ` · ${copy.shell.asOf} ${asOf}` : null}
    </footer>
  );
}
