import type { ProductCard } from '@/lib/marketplace/catalog';
import type { DataProduct, Pack } from '@/lib/packs/schema';
import type { Principal } from '@/lib/query/types';
import { ContractTab, SchemaTab } from './contract';
import { AgentsTab, ConsumptionTab, HistoryTab, OverviewTab, SemanticTab, ValueTab } from './overview';
import { LineageTab, QualityTab } from './quality';

export const TABS = ['overview', 'contract', 'schema', 'quality', 'lineage', 'semantic', 'consumption', 'agents', 'value', 'history'] as const;
export type Tab = (typeof TABS)[number];

export interface TabProps {
  pack: Pack;
  product: DataProduct;
  card: ProductCard;
  who: Principal;
}

export async function ProductTab({ tab, ...p }: TabProps & { tab: Tab }) {
  switch (tab) {
    case 'contract':
      return <ContractTab {...p} />;
    case 'schema':
      return <SchemaTab {...p} />;
    case 'quality':
      return <QualityTab {...p} />;
    case 'lineage':
      return <LineageTab {...p} />;
    case 'semantic':
      return <SemanticTab {...p} />;
    case 'consumption':
      return <ConsumptionTab {...p} />;
    case 'agents':
      return <AgentsTab {...p} />;
    case 'value':
      return <ValueTab {...p} />;
    case 'history':
      return <HistoryTab {...p} />;
    default:
      return <OverviewTab {...p} />;
  }
}
