/**
 * Demo Profiles (09 §4, 01 §M1): pack + branding + terminology + story + agent mode. Saved in the app DB
 * (AC1.3), snapshotted on save so Reset returns to this starting state (AC1.4), exportable as JSON with no
 * secrets. Brand colours failing WCAG AA are rejected with a suggested alternative (AC1.2).
 */
import { z } from 'zod';
import { controlDb, createProfileDb, dropProfileDb, profileDbCurrent, withProfileDb } from '@/lib/db';
import { appendAudit } from '@/lib/db/audit';
import { getPack, getStories, hasPack } from '@/lib/packs/registry';
import { type Brand, checkBrand, DEFAULT_BRAND } from './branding';
import { deleteSnapshot, deleteSnapshots, takeSnapshot } from './reset';

export const AGENT_MODES = ['scripted', 'auto', 'live'] as const;
const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #rrggbb colour');
/** ≤ 200 KB PNG or SVG as a data URL. */
const LOGO = z
  .string()
  .regex(/^data:image\/(png|svg\+xml);base64,[A-Za-z0-9+/=]+$/, 'Logo must be a PNG or SVG')
  .refine((s) => s.length <= Math.ceil((200 * 1024 * 4) / 3) + 40, 'Logo must be 200 KB or smaller');

export const ProfileInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    packId: z.string().refine(hasPack, 'Unknown pack'),
    brand: z.object({ productName: z.string().trim().min(1).max(80), companyName: z.string().trim().min(1).max(80), logoDataUrl: LOGO.optional(), primary: HEX, accent: HEX }).strict(),
    terms: z.record(z.string().min(1).max(60), z.string().trim().min(1).max(60)).default({}),
    storyId: z.string().nullable().default(null),
    agentMode: z.enum(AGENT_MODES).default('scripted'),
    locked: z.boolean().default(false),
  })
  .strict();
export type ProfileInput = z.infer<typeof ProfileInput>;

export interface Profile extends ProfileInput {
  id: string;
  archived: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export class ProfileError extends Error {
  constructor(
    message: string,
    readonly suggestions: { field: string; colour: string; suggestion: string }[] = [],
  ) {
    super(message);
  }
}

type Row = Awaited<ReturnType<ReturnType<typeof controlDb>['demoProfile']['findFirstOrThrow']>>;

function toProfile(r: Row): Profile {
  const brand = JSON.parse(r.brandJson) as ProfileInput['brand'];
  return { id: r.id, name: r.name, packId: r.packId, brand, terms: JSON.parse(r.termsJson) as Record<string, string>, storyId: r.storyId, agentMode: r.agentMode as ProfileInput['agentMode'], locked: r.locked, archived: Boolean(r.archivedAt), lastUsedAt: r.lastUsedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() };
}

/** Validation beyond the schema: AA contrast, story exists, only the pack's overridable terms. */
export function validateProfile(raw: unknown): ProfileInput {
  const parsed = ProfileInput.safeParse(raw);
  if (!parsed.success) throw new ProfileError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const input = parsed.data;
  const check = checkBrand(input.brand);
  if (!check.ok) throw new ProfileError(`Brand colours must meet WCAG AA contrast: ${check.problems.map((p) => `${p.field} ${p.colour} → try ${p.suggestion}`).join('; ')}`, check.problems);
  if (input.storyId && !getStories().some((s) => s.id === input.storyId)) throw new ProfileError(`Unknown story ${input.storyId}`);
  const allowed = overridableTerms(input.packId);
  const unknown = Object.keys(input.terms).filter((k) => !allowed.includes(k));
  if (unknown.length) throw new ProfileError(`Not overridable in this pack: ${unknown.join(', ')}`);
  return input;
}

/** Display strings a profile may rename: regions (when allowed) and the pack's listed terms. */
export function overridableTerms(packId: string): string[] {
  const pack = getPack(packId);
  return [...(pack.manifest.overridable.regions ? pack.manifest.regions : []), ...pack.manifest.overridable.terms];
}

export function defaultProfileInput(packId: string): ProfileInput {
  const pack = getPack(packId);
  return { name: pack.manifest.company.name, packId, brand: { productName: DEFAULT_BRAND.productName, companyName: pack.manifest.company.name, primary: DEFAULT_BRAND.primary, accent: DEFAULT_BRAND.accent }, terms: {}, storyId: null, agentMode: 'scripted', locked: false };
}

/**
 * Gives a profile its own app DB (a copy of the control DB, ADR-0024) and snapshots it as the profile's
 * starting point; its story checkpoints are dropped. On a non-SQLite control DB the profile shares it.
 */
async function startProfileState(id: string): Promise<void> {
  const own = await createProfileDb(id);
  await withProfileDb(own ? id : null, () => takeSnapshot(id));
  deleteSnapshots(`${id}__`);
}

/** Saves a profile (control DB) and gives it its own app DB with a starting snapshot. */
export async function createProfile(raw: unknown, actorId = 'presenter'): Promise<Profile> {
  const input = validateProfile(raw);
  const prisma = controlDb();
  const row = await prisma.demoProfile.create({ data: { name: input.name, packId: input.packId, brandJson: JSON.stringify(input.brand), termsJson: JSON.stringify(input.terms), storyId: input.storyId, agentMode: input.agentMode, locked: input.locked } });
  await appendAudit(prisma, { packId: input.packId, actorType: 'HUMAN', actorId, action: 'PROFILE_CREATED', subjectType: 'DEMO_PROFILE', subjectId: row.id, detail: { name: input.name, storyId: input.storyId } });
  await startProfileState(row.id);
  return toProfile(await prisma.demoProfile.update({ where: { id: row.id }, data: { snapshotAt: new Date() } }));
}

/**
 * Before a launch: a profile whose DB is missing, or older than the control DB's migrations (after an
 * upgrade), gets a fresh copy and starting snapshot. Returns true when it was (re)created.
 */
export async function ensureProfileState(id: string): Promise<boolean> {
  if (await profileDbCurrent(id)) return false;
  await startProfileState(id);
  await controlDb().demoProfile.update({ where: { id }, data: { snapshotAt: new Date() } });
  return true;
}

export async function updateProfile(id: string, raw: unknown): Promise<Profile> {
  const input = validateProfile(raw);
  const row = await controlDb().demoProfile.update({ where: { id }, data: { name: input.name, brandJson: JSON.stringify(input.brand), termsJson: JSON.stringify(input.terms), storyId: input.storyId, agentMode: input.agentMode, locked: input.locked } });
  return toProfile(row);
}

export async function listProfiles(opts: { includeArchived?: boolean } = {}): Promise<Profile[]> {
  try {
    const rows = await controlDb().demoProfile.findMany({ where: opts.includeArchived ? {} : { archivedAt: null }, orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }] });
    return rows.map(toProfile);
  } catch {
    return [];
  }
}

export async function getProfile(id: string | null | undefined): Promise<Profile | null> {
  if (!id) return null;
  const row = await controlDb().demoProfile.findUnique({ where: { id } }).catch(() => null);
  return row ? toProfile(row) : null;
}

export async function markUsed(id: string): Promise<void> {
  await controlDb().demoProfile.update({ where: { id }, data: { lastUsedAt: new Date() } });
}

/** Archive (profiles are never hard-deleted); its app DB, snapshot and checkpoints are removed. */
export async function archiveProfile(id: string): Promise<void> {
  await controlDb().demoProfile.update({ where: { id }, data: { archivedAt: new Date() } });
  await dropProfileDb(id);
  deleteSnapshot(id);
  deleteSnapshots(`${id}__`);
}

export async function duplicateProfile(id: string): Promise<Profile> {
  const p = await getProfile(id);
  if (!p) throw new ProfileError('Unknown profile');
  return createProfile({ name: `${p.name} (copy)`, packId: p.packId, brand: p.brand, terms: p.terms, storyId: p.storyId, agentMode: p.agentMode, locked: false });
}

/** `.keystone-profile.json` — everything needed to recreate the profile elsewhere; no secrets. */
export function exportProfile(p: Profile): string {
  const { name, packId, brand, terms, storyId, agentMode, locked } = p;
  return `${JSON.stringify({ format: 'keystone-profile', version: 1, profile: { name, packId, brand, terms, storyId, agentMode, locked } }, null, 2)}\n`;
}

export async function importProfile(json: string): Promise<Profile> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ProfileError('Not a JSON file');
  }
  const env = z.object({ format: z.literal('keystone-profile'), version: z.literal(1), profile: z.unknown() }).safeParse(data);
  if (!env.success) throw new ProfileError('Not a Demo Profile file');
  return createProfile(env.data.profile);
}

/** The brand an active profile applies (or the default with the pack's company). */
export function brandFor(profile: Profile | null, companyName: string): Brand {
  if (!profile) return { ...DEFAULT_BRAND, companyName };
  return { productName: profile.brand.productName, companyName: profile.brand.companyName, logoSvg: profile.brand.logoDataUrl, primary: profile.brand.primary, accent: profile.brand.accent };
}
