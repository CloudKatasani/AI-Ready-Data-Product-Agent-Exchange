# Presenter guide

Keystone tells one story four ways: raw data becomes **governed data products**, and **AI agents** answer
business questions with **cited, policy-checked numbers**, run by an operator and steered by leadership.
Three promises carry every demo:
- **Agents act, humans decide.**
- **Every number is earned.**
- **The demo never breaks.**

## Before the meeting (10 minutes)
1. `pnpm doctor` → **Demo ready.**
2. Open **/launch**, pick the client's industry and choose **Profile setup**:
   - Company display name, product name, logo (PNG/SVG ≤ 200 KB) and brand colours. The contrast check
     rejects colours that fail WCAG AA and suggests an accessible one; click it to apply.
   - Terminology: rename regions and terms to the client's words. This changes display only; numbers and SQL are unchanged.
   - Story: Executive 5′, Business 15′, Platform 30′, Implementation 15′, Agent Factory 10′, Lifecycle 15′ or Free roam.
   - Agent mode: Scripted is deterministic and offline. Auto uses the live model and falls back visibly. Live needs an API key.
   - **Lock** hides the launcher (kiosk) for leave-behind machines.
3. **Save**. This snapshots the starting state. Then **Launch**: you land on Home, branded, as the story's first persona.

## During the demo
- **Shift+P** opens the presenter overlay:
  - story rail with **Go** for each step;
  - cue card ("Do this" / "Say this") with the next step previewed;
  - step and total timers against the story length.
- **Shift+→ / Shift+←** move to the next or previous step. Go switches persona, sets the screen state and restores the step's checkpoint when it has one.
- **Persona switcher** (top right):
  - A — row-filtered business user;
  - B — analyst;
  - C — product owner;
  - D — data steward, who sees sensitive data and approves;
  - E — executive.

  Every policy is enforced server-side.
- **Break something / Fix it** (overlay or Health): open a scripted incident (late feed, null spike, duplicate load, schema drift, volume gap). Affected products degrade, agent answers carry an incident banner and drop to Questionable, and Resolve writes a postmortem.
- **Reset demo** (overlay, confirm): back to the profile's starting state in well under 3 s. The profile and branding stay.

## The six stories at a glance
| Story | Where it goes | The moment to land |
|---|---|---|
| **Executive 5′**: Trust the number | Home → trace → persona A → Knockout → Readiness | Switch Context off: the KPI jumps and confidence drops. Here is your path |
| **Business 15′**: From raw data to a trusted answer | Platform Map → Explorer → Semantic → Studio (certify) → Marketplace (access) → Ask | Two certification fixes, quorum by switching to persona D, then v1.0.0 published. The declined question now answers with a citation |
| **Platform 30′** | Explorer DDL/worksheet → Semantic YAML → Ask (Live vs Scripted) → Health → Impact → Cost → Platform Map → Exports | Identical numbers in Live and Scripted. Blast radius and a 30-day notice for a breaking change |
| **Implementation 15′** | Readiness → Roadmap → Coverage (Simulate +4 weeks) → Operating Model → Portfolio → Maturity | The roadmap is generated from the gaps. A human override with a reason |
| **Agent Factory 10′** | Factory → design → evaluate → publish gate → release → Ask and Marketplace | The gate blocks a non-certified binding. A human approves each release stage |
| **Lifecycle 15′**: Agents act, humans decide | Request → triage → Autopilot → review → gate → stale cascade → audit | Submit is blocked while agent fields are unreviewed. The audit shows agents never approve |

**Print cue cards** (overlay) opens a printable page per story. Print it to PDF for the leave-behind.

## Answers you will be asked
- **"Is this real data?"** No. Everything is synthetic: fictional companies, generated people, illustrative pricing. Every screen footer says so.
- **"Can the AI make up a number?"**
  - In Scripted mode every number comes from a governed query.
  - In Live mode a grounding validator rejects any number not in a tool result, allows one repair, and otherwise falls back visibly.
  - Every number carries a citation: product, version, metric definition and SQL.
- **"Who approved this?"** Gates, access grants, certification and releases each record a named human decision. Agents draft and propose only. The audit stream is hash-chained.
- **"Does it work with our platform?"** The governed path is warehouse-agnostic (`WarehouseAdapter`). The demo runs on DuckDB with Snowflake-style schemas and shows Snowflake-dialect SQL.

## If something goes wrong
| Problem | What to do |
|---|---|
| A screen looks wrong after improvising | Reset demo |
| A live answer shows "Live→Scripted fallback" | That is the design: say so, and keep going |
| A pack page says its warehouse is missing | Run `pnpm warehouse:build --pack <id>` before the meeting, or use the image with prebuilt warehouses |
