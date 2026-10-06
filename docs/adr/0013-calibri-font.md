# ADR-0013 — Calibri as the UI typeface

- Status: Accepted (Phase 2) — owner decision, supersedes "Inter, bundled locally" in 07-ui-ux §2 for UI text.

## Context
07-ui-ux §2 specifies Inter bundled locally. The owner asked for Calibri. Calibri is a licensed
Microsoft font and may not be redistributed in this repository or the Docker image.

## Decision
`--font-sans: Calibri, Carlito, 'Segoe UI', system-ui, …`. Presenter laptops with Windows or Microsoft
Office render Calibri; elsewhere Carlito (SIL OFL, metric-compatible with Calibri) is used when installed,
then the system UI font. Nothing is downloaded at runtime, so offline Scripted mode is unaffected.
Code/SQL keeps the monospace stack (`JetBrains Mono` if installed, else the system monospace font).

## Consequences
- Layout metrics are identical on machines with Calibri or Carlito.
- If a bundled fallback is wanted later, vendor Carlito `.woff2` files (OFL permits it) under `public/fonts/`.
