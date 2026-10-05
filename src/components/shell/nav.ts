import {
  Activity,
  BookOpen,
  Bot,
  Boxes,
  Coins,
  Database,
  FileSearch,
  FlaskConical,
  Gauge,
  GitCompare,
  Home,
  KeyRound,
  Layers,
  LayoutGrid,
  ListChecks,
  type LucideIcon,
  MessageSquare,
  PlusSquare,
  Route,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Waypoints,
  Workflow,
} from 'lucide-react';
import type { copy } from '@/copy/en';

export type DoorId = keyof typeof copy.doors;
export type NavId = keyof typeof copy.nav;
export type ModuleId = `M${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`;

export interface NavItem {
  id: NavId;
  /** Path below `/[pack]`, without leading slash. */
  path: string;
  icon: LucideIcon;
  module: ModuleId;
  /** Build-plan phase that delivers the screen (11-build-plan.md). */
  phase: number;
  /** Section of the specification that defines the screen. */
  spec: string;
}

export interface Door {
  id: DoorId;
  items: NavItem[];
}

/** Left navigation, grouped by door (01-functional-spec §3). Presenter routes are not in the nav. */
export const DOORS: Door[] = [
  {
    id: 'home',
    items: [{ id: 'home', path: 'home', icon: Home, module: 'M2', phase: 3, spec: '01 §M2' }],
  },
  {
    id: 'consume',
    items: [
      { id: 'marketplace', path: 'marketplace', icon: LayoutGrid, module: 'M3', phase: 4, spec: '01 §M3' },
      { id: 'ask', path: 'ask', icon: MessageSquare, module: 'M4', phase: 3, spec: '01 §M4, 08' },
      { id: 'access', path: 'access', icon: KeyRound, module: 'M5', phase: 4, spec: '01 §M5' },
      { id: 'request', path: 'request/new', icon: PlusSquare, module: 'M5', phase: 5, spec: '01 §M5, 06 §7' },
    ],
  },
  {
    id: 'build',
    items: [
      { id: 'studio', path: 'studio', icon: Workflow, module: 'M6', phase: 5, spec: '01 §M6, 06' },
      { id: 'factory', path: 'factory', icon: Bot, module: 'M7', phase: 6, spec: '01 §M7, 08' },
      { id: 'explorer', path: 'explorer', icon: Database, module: 'M8', phase: 2, spec: '01 §M8, 05' },
      { id: 'semantic', path: 'semantic', icon: Boxes, module: 'M9', phase: 2, spec: '01 §M9, 05 §1' },
      { id: 'glossary', path: 'glossary', icon: BookOpen, module: 'M9', phase: 2, spec: '01 §M9' },
      { id: 'context', path: 'context', icon: FileSearch, module: 'M9', phase: 2, spec: '01 §M9, 05 §7' },
    ],
  },
  {
    id: 'run',
    items: [
      { id: 'health', path: 'health', icon: Activity, module: 'M10', phase: 7, spec: '01 §M10' },
      { id: 'agentQuality', path: 'agent-quality', icon: FlaskConical, module: 'M10', phase: 7, spec: '01 §M10, 08 §5' },
      { id: 'costValue', path: 'cost-value', icon: Coins, module: 'M10', phase: 7, spec: '01 §M10' },
      { id: 'impact', path: 'impact', icon: Waypoints, module: 'M10', phase: 7, spec: '01 §M10' },
      { id: 'audit', path: 'audit', icon: ShieldCheck, module: 'M10', phase: 7, spec: '01 §M10, 06 §8' },
    ],
  },
  {
    id: 'strategy',
    items: [
      { id: 'platformMap', path: 'platform-map', icon: Layers, module: 'M11', phase: 8, spec: '01 §M11, 07 §4.4' },
      { id: 'knockout', path: 'why/knockout', icon: Sparkles, module: 'M11', phase: 8, spec: '01 §M11, 05 §1.7' },
      { id: 'compare', path: 'why/compare', icon: GitCompare, module: 'M11', phase: 8, spec: '01 §M11' },
      { id: 'readiness', path: 'readiness', icon: Gauge, module: 'M11', phase: 8, spec: '01 §M11' },
      { id: 'roadmap', path: 'roadmap', icon: Route, module: 'M11', phase: 8, spec: '01 §M11' },
      { id: 'portfolio', path: 'portfolio', icon: ListChecks, module: 'M11', phase: 8, spec: '01 §M11' },
      { id: 'operatingModel', path: 'operating-model', icon: Users, module: 'M11', phase: 8, spec: '01 §M11' },
    ],
  },
];

/** Not in the door nav: reachable from the presenter menu (Persona D or presenter). */
export const ADMIN_ITEM: NavItem = { id: 'admin', path: 'admin', icon: Settings, module: 'M12', phase: 11, spec: '01 §M12' };

export const ALL_NAV_ITEMS: NavItem[] = [...DOORS.flatMap((d) => d.items), ADMIN_ITEM];

export function navItem(id: NavId): NavItem {
  const item = ALL_NAV_ITEMS.find((i) => i.id === id);
  if (!item) throw new Error(`Unknown nav item: ${id}`);
  return item;
}

export function packHref(pack: string, path: string): string {
  return `/${encodeURIComponent(pack)}/${path}`;
}

/** The nav item whose path is the longest prefix of `pathname` (below `/[pack]`). */
export function activeNavId(pathname: string): NavId | undefined {
  const rest = pathname.split('/').slice(2).join('/');
  let best: { id: NavId; length: number } | undefined;
  for (const item of ALL_NAV_ITEMS) {
    // `request/new` owns every `request/*` route.
    const base = item.path.endsWith('/new') ? item.path.slice(0, -'/new'.length) : item.path;
    if ((rest === base || rest.startsWith(`${base}/`)) && (!best || base.length > best.length)) {
      best = { id: item.id, length: base.length };
    }
  }
  return best?.id;
}
