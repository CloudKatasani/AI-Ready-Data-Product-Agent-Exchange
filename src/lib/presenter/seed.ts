import type { PrismaClient } from '@prisma/client';
import { appendAudit } from '@/lib/db/audit';
import type { Pack } from '@/lib/packs/schema';

/** Seeds personas and initial entitlements for one pack (idempotent: replaces the pack's rows). */
export async function seedPack(prisma: PrismaClient, pack: Pack): Promise<{ personas: number; entitlements: number }> {
  const packId = pack.manifest.id;
  const personaIds = pack.personas.map((p) => p.id);
  await prisma.entitlement.deleteMany({ where: { personaId: { in: personaIds }, grantedVia: 'SEED' } });
  await prisma.persona.deleteMany({ where: { packId } });
  await prisma.persona.createMany({
    data: pack.personas.map((p) => ({
      id: p.id,
      packId,
      archetype: p.archetype,
      name: p.name,
      title: p.title,
      domain: p.domain,
      rolesJson: JSON.stringify(p.roles),
      rowFilterJson: p.row_filter ? JSON.stringify(p.row_filter) : null,
      unmaskedJson: JSON.stringify(p.unmasked),
      avatarSeed: p.id,
    })),
  });
  const grants = pack.policies.grants.flatMap((g) => [
    ...g.products.map((id) => ({ personaId: g.persona, subjectType: 'PRODUCT', subjectId: id, purpose: 'Initial demo entitlement', grantedVia: 'SEED' })),
    ...g.agents.map((id) => ({ personaId: g.persona, subjectType: 'AGENT', subjectId: id, purpose: 'Initial demo entitlement', grantedVia: 'SEED' })),
  ]);
  await prisma.entitlement.createMany({ data: grants });
  await appendAudit(prisma, { packId, actorType: 'SYSTEM', actorId: 'seed', action: 'PACK_SEEDED', subjectType: 'PACK', subjectId: packId, detail: { version: pack.manifest.version, personas: personaIds.length, entitlements: grants.length } });
  return { personas: personaIds.length, entitlements: grants.length };
}
