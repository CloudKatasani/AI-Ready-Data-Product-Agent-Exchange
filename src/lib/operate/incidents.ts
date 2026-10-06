/**
 * "Break something" (01 §M10 Health): open a pack incident template, resolve it with a postmortem. While
 * an incident is open its effects overlay the governed query path (`src/lib/query/incidents.ts`), so the
 * affected products turn Degraded and agent answers carry an incident banner. Every transition is audited.
 */
import type { PrismaClient } from '@prisma/client';
import { appendAudit } from '@/lib/db/audit';
import type { IncidentTemplate, Pack } from '@/lib/packs/schema';

export class IncidentError extends Error {}

/** Minutes from fault to detection, by kind — the cadence of the check that catches it (illustrative). */
export const DETECTION_MINUTES: Record<IncidentTemplate['kind'], number> = { late_feed: 15, null_spike: 10, duplicate_load: 30, schema_drift: 5, volume_anomaly: 60 };

export interface Postmortem {
  templateId: string;
  timeToDetectMinutes: number;
  timeToResolveMinutes: number;
  detection: string;
  impact: string;
  resolution: string;
  actions: string[];
}

export interface IncidentView {
  id: string;
  templateId: string;
  title: string;
  severity: string;
  state: string;
  kind: IncidentTemplate['kind'];
  object: string;
  products: string[];
  agents: string[];
  narrative: string;
  detectedAt: string;
  resolvedAt: string | null;
  postmortem: Postmortem | null;
}

function template(pack: Pack, templateId: string): IncidentTemplate {
  const t = pack.incidents.find((x) => x.id === templateId);
  if (!t) throw new IncidentError(`Unknown incident template ${templateId}`);
  return t;
}

/** Opens a template as a live incident (idempotent: an already-open one is returned). */
export async function breakIncident(client: PrismaClient, pack: Pack, templateId: string, personaId: string): Promise<string> {
  const t = template(pack, templateId);
  const packId = pack.manifest.id;
  const open = await client.incident.findFirst({ where: { packId, templateId, state: { not: 'RESOLVED' } } });
  if (open) return open.id;
  const row = await client.incident.create({
    data: {
      packId,
      templateId,
      title: t.title,
      severity: t.severity,
      state: 'OPEN',
      affectedJson: JSON.stringify({ object: t.object, products: t.affects.products, agents: t.affects.agents }),
      effectsJson: JSON.stringify({ kind: t.kind, column: t.column ?? null, params: t.params }),
      openedBy: personaId,
    },
  });
  await appendAudit(client, { packId, actorType: 'HUMAN', actorId: personaId, action: 'INCIDENT_OPENED', subjectType: 'INCIDENT', subjectId: row.id, detail: { templateId, severity: t.severity, products: t.affects.products } });
  return row.id;
}

/** Resolves an incident and writes its postmortem (time to detect from the kind's check cadence). */
export async function resolveIncident(client: PrismaClient, pack: Pack, incidentId: string, personaId: string, now: Date): Promise<Postmortem> {
  const row = await client.incident.findUnique({ where: { id: incidentId } });
  if (!row || row.packId !== pack.manifest.id) throw new IncidentError(`Unknown incident ${incidentId}`);
  if (row.state === 'RESOLVED') throw new IncidentError(`${incidentId} is already resolved.`);
  const t = template(pack, row.templateId);
  const postmortem: Postmortem = {
    templateId: t.id,
    timeToDetectMinutes: DETECTION_MINUTES[t.kind],
    timeToResolveMinutes: Math.max(1, Math.round((now.getTime() - row.detectedAt.getTime()) / 60_000)),
    detection: t.detection,
    impact: t.narrative,
    resolution: t.resolution,
    actions: [`Add an alert on ${t.object} for this failure mode.`, `Re-run the DQ rules for ${t.affects.products.join(', ')}.`, `Re-evaluate ${t.affects.agents.join(', ') || 'dependent agents'} after the fix.`],
  };
  await client.incident.update({ where: { id: incidentId }, data: { state: 'RESOLVED', resolvedAt: now, resolvedBy: personaId, postmortemJson: JSON.stringify(postmortem) } });
  await appendAudit(client, { packId: pack.manifest.id, actorType: 'HUMAN', actorId: personaId, action: 'INCIDENT_RESOLVED', subjectType: 'INCIDENT', subjectId: incidentId, detail: { templateId: t.id, timeToResolveMinutes: postmortem.timeToResolveMinutes } });
  return postmortem;
}

export async function listIncidents(client: PrismaClient, pack: Pack): Promise<IncidentView[]> {
  const rows = await client.incident.findMany({ where: { packId: pack.manifest.id }, orderBy: [{ detectedAt: 'desc' }, { id: 'desc' }] });
  return rows.flatMap((r) => {
    const t = pack.incidents.find((x) => x.id === r.templateId);
    if (!t) return [];
    return [
      {
        id: r.id,
        templateId: r.templateId,
        title: r.title,
        severity: r.severity,
        state: r.state,
        kind: t.kind,
        object: t.object,
        products: t.affects.products,
        agents: t.affects.agents,
        narrative: t.narrative,
        detectedAt: r.detectedAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        postmortem: r.postmortemJson ? (JSON.parse(r.postmortemJson) as Postmortem) : null,
      },
    ];
  });
}
