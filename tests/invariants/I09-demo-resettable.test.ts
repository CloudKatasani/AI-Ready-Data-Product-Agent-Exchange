import { describe, expect, it } from "vitest";
import { isolateDb } from "../setup/isolated-db";

await isolateDb("i09");

// CLAUDE.md §4.9 — Demo resettable (snapshot copy, < rubrics.demo.reset_target_ms).
describe("I09 demo resettable", async () => {
  const { db, withProfileDb } = await import("@/lib/db");
  const { getPack, getRubrics } = await import("@/lib/packs/registry");
  const { createProfile, defaultProfileInput, getProfile } =
    await import("@/lib/presenter/profiles");
  const { resetDemo, checkpoint } = await import("@/lib/presenter/reset");
  const { breakNow } = await import("@/lib/presenter/operate");
  // An incident template not already open in the (copied) state: breakNow reuses an open incident.
  const freshTemplate = async (): Promise<string> => {
    const open = await db().incident.findMany({ where: { packId: "utilities", state: { not: "RESOLVED" } }, select: { templateId: true } });
    const t = pack.incidents.find((x) => !open.some((o) => o.templateId === x.id));
    if (!t) throw new Error("every incident template is already open");
    return t.id;
  };
  const pack = getPack("utilities");
  const steward = pack.personas.find((p) => p.archetype === "D")?.id ?? "";

  it("resetDemo() restores app DB state for the active profile to the snapshot (warehouse is read-only at runtime)", async () => {
    const profile = await createProfile({
      ...defaultProfileInput("utilities"),
      name: "I09",
      storyId: "executive-5",
    });
    // As the presenter's requests do (profile cookie), act on the profile's own app DB (ADR-0024).
    await withProfileDb(profile.id, async () => {
      const before = {
        incidents: await db().incident.count(),
        audit: await db().auditEvent.count(),
        titles: await db().persona.findMany({
          orderBy: { id: "asc" },
          select: { title: true },
        }),
      };
      await breakNow("utilities", await freshTemplate(), steward);
      await db().persona.updateMany({
        data: { title: "Changed during the demo" },
      });
      expect(await db().incident.count()).toBe(before.incidents + 1);
      await resetDemo(profile.id);
      expect(await db().incident.count()).toBe(before.incidents);
      expect(await db().auditEvent.count()).toBe(before.audit);
      expect(
        await db().persona.findMany({
          orderBy: { id: "asc" },
          select: { title: true },
        }),
      ).toEqual(before.titles);
    });
  });

  it("resetDemo() completes in under rubrics demo.reset_target_ms (3 s) using snapshot copy, not re-seed", async () => {
    const profile = await createProfile({
      ...defaultProfileInput("utilities"),
      name: "I09 timing",
    });
    await withProfileDb(profile.id, () =>
      db().persona.updateMany({ data: { title: "x" } }),
    );
    const r = await resetDemo(profile.id);
    expect(r.tables).toBeGreaterThan(30);
    expect(r.ms).toBeLessThan(getRubrics().demo.reset_target_ms);
  });

  it("reset keeps the profile and its branding; checkpoints rewind to the step", async () => {
    const profile = await createProfile({
      ...defaultProfileInput("utilities"),
      name: "Branded",
      brand: {
        productName: "Insight Hub",
        companyName: "Client Co",
        primary: "#7c2d12",
        accent: "#0f766e",
      },
    });
    expect(await checkpoint(profile.id, "executive-5", "e1")).toBe("taken");
    await withProfileDb(profile.id, async () => {
      const at = await db().incident.count();
      await breakNow("utilities", await freshTemplate(), steward);
      expect(await db().incident.count()).toBe(at + 1);
      expect(await checkpoint(profile.id, "executive-5", "e1")).toBe(
        "restored",
      );
      expect(await db().incident.count()).toBe(at);
    });
    await resetDemo(profile.id);
    const kept = await getProfile(profile.id);
    expect(kept?.brand.productName).toBe("Insight Hub");
    expect(kept?.brand.primary).toBe("#7c2d12");
  });
});
