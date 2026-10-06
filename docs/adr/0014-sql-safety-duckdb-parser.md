# ADR-0014 — Worksheet SQL safety uses DuckDB's own parser

- Status: Accepted (Phase 2)

## Context
05 §3 suggests `node-sql-parser` for the worksheet allow-list. It is not in the CLAUDE.md §3 stack, and
a third-party grammar can disagree with what DuckDB actually executes.

## Decision
`src/lib/query/sql-safety.ts` asks DuckDB to parse the text (`json_serialize_sql`) without executing it.
Exactly one statement of type SELECT (CTEs allowed) is accepted; the AST is walked to reject deny-listed
functions (`read_*`, `glob`, `system`, `pragma_*`, `current_setting`, …) and table functions, and to collect
the referenced tables. Statement-level verbs (`ATTACH`, `COPY`, `INSTALL`, `LOAD`, `SET`, `PRAGMA`,
`EXPORT`, `;` chaining) fail the statement-type check. The connection additionally runs with
`enable_external_access=false` and `lock_configuration=true`, so file access is impossible even if a
check were missed. Referenced tables are then rewritten through the policy engine (masking, row access).

The worksheet editor is a monospace `<textarea>` in Phase 2 (CodeMirror is not in the stack either);
syntax highlighting can be added later behind the same component.

## Consequences
No extra dependency; the safety check and the executor share one grammar.
