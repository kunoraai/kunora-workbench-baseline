# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Selected design (2026-08-31)

The user selected the third displayed concept, `../../docs/workbench/harness-redesign-2026-08-31/concepts/03-file-comparison.png`. They noted the alternatives were too similar; proceed with the selected file-comparison layout without another ideation round. Use KUNORA.internal Foundation 1.2 and supplied original mechanical-whale/wordmark SVGs. Keep this prototype separate from the frozen `../../dsh/` and existing business mockups. Chat execution is explicitly local simulation, with no live model calls, filesystem changes, or acceptance results. No persistence or external integrations are included.

## Continuation (2026-08-31)

The user requested the navigation/window product title `Kunora Workbench` and continued design of other surfaces. Use this exact product name in the document title and navigation, retaining the supplied mechanical-whale mark. Preserve the original wordmark asset without displaying the old product name. Extend the selected visual direction to new-session guidance, searchable session history with reversible archiving, and grouped settings. Preserve drafts when navigating, choosing suggestions, renaming, and archiving. Model and plugin screens must clearly disclose their disconnected prototype status; never collect credentials or imply live integrations.

The next continuation adds workspace-group management, a session action menu, and current-session file browsing. Workspace rename must preserve session associations and drafts; these groups do not connect directories. Session copies are independent local snapshots, not Git branches or live agent forks. File previews use only the existing sample payloads; referencing a file appends its name to the draft and never sends or uploads it. Retain the selected blue/white style and existing conversation/diff layout.
