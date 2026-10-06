import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPack, loadSharedFile } from './loader';
import { AdversarialFile, type Pack, Rubrics, StoriesFile, type Story } from './schema';
import type { z } from 'zod';

/** Directory holding `packs/<id>/` and `packs/_shared/`. Override with KEYSTONE_PACKS_DIR (tests). */
export function packsDir(): string {
  return resolve(process.env.KEYSTONE_PACKS_DIR ?? join(process.cwd(), 'packs'));
}

/** Installed pack ids: every directory under packs/ with a pack.yaml, excluding `_shared` and `_schema`. */
export function listPackIds(dir = packsDir()): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name !== '_shared' && name !== '_schema')
    .filter((name) => statSync(join(dir, name)).isDirectory() && existsSync(join(dir, name, 'pack.yaml')))
    .sort();
}

const cache = new Map<string, Pack>();

/** The single entry point UI and services use to read industry content (invariant I01). */
export function getPack(id: string, dir = packsDir()): Pack {
  const key = `${dir}::${id}`;
  let pack = cache.get(key);
  if (!pack) {
    if (!listPackIds(dir).includes(id)) throw new Error(`Unknown pack: ${id}`);
    pack = loadPack(join(dir, id));
    cache.set(key, pack);
  }
  return pack;
}

export function hasPack(id: string, dir = packsDir()): boolean {
  return listPackIds(dir).includes(id);
}

let rubrics: Rubrics | undefined;
let stories: Story[] | undefined;
let adversarial: z.infer<typeof AdversarialFile> | undefined;

export function getRubrics(dir = packsDir()): Rubrics {
  rubrics ??= loadSharedFile(dir, 'rubrics.yaml', Rubrics);
  return rubrics;
}

export function getStories(dir = packsDir()): Story[] {
  stories ??= loadSharedFile(dir, 'stories.yaml', StoriesFile);
  return stories;
}

export function getAdversarial(dir = packsDir()): z.infer<typeof AdversarialFile> {
  adversarial ??= loadSharedFile(dir, 'adversarial.yaml', AdversarialFile);
  return adversarial;
}

/** Drops cached packs (dev hot-reload, tests). */
export function clearPackCache(): void {
  cache.clear();
  rubrics = undefined;
  stories = undefined;
  adversarial = undefined;
}
