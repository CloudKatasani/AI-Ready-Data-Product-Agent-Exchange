import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { copy } from '@/copy/en';
import { navItem, type NavId } from './nav';

interface StubPageProps {
  navId: NavId;
  /** Overrides the heading for detail screens (e.g. a product page under Marketplace). */
  title?: string;
  params?: Record<string, string | undefined>;
}

/** Placeholder for a scaffolded route (Phase 0). Replaced by the real screen in the phase shown. */
export function StubPage({ navId, title, params = {} }: StubPageProps) {
  const item = navItem(navId);
  const Icon = item.icon;
  const entries = Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" data-stub={navId}>
      <div className="flex items-center gap-3">
        <Icon aria-hidden className="size-7 text-primary" />
        <h1 className="text-2xl font-semibold">{title ?? copy.nav[navId]}</h1>
        <Badge variant="muted">
          {copy.stub.eyebrow} {item.phase}
        </Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {copy.stub.module} {item.module}
          </CardTitle>
          <CardDescription>{copy.stub.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">{copy.stub.spec}</dt>
            <dd>{item.spec}</dd>
            <dt className="text-muted-foreground">{copy.stub.params}</dt>
            <dd className="font-mono">
              {entries.length === 0 ? copy.stub.none : entries.map(([k, v]) => `${k}=${v}`).join(' · ')}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
