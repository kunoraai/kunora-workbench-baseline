# Design QA — iteration 1

Source: `../../docs/workbench/harness-redesign-2026-08-31/concepts/03-file-comparison.png` (1487×1058).
Implementation: `qa/desktop-initial.png` (1487×1058), `qa/mobile-initial.png`, `qa/mobile-detail-initial.png` (390×844). Desktop source and implementation were opened together in one comparison input; no density adjustment was required (1 CSS px = 1 output px).

State: initial form session, completed example turn, AssociateTask.tsx details open. Mobile adaptation has no source mock and is evaluated for behavior/readability separately.

## Findings

- P2: Mobile before/after column headings do not move with horizontally scrolling code. Evidence: `qa/mobile-detail-initial.png`. Fix: mobile inspector uses explicit Before/After tabs with a single readable code pane; desktop retains paired diff.
- P2: Sidebar, tool records and output-file type are smaller than the source. Evidence: combined desktop comparison. Fix: raise sidebar to 16px and tool/file labels to 15px, code to 13px; maintain the same hierarchy.
- P2: Mobile command icon has no accessible name when its visible text is hidden. Fix explicit aria-labels on command and attachment buttons.
- P2: Long code lines can be clipped by a hidden-overflow column. Fix: size code canvas from the actual longest line and allow scrolling within the inspector.

## Accepted differences

- Original brand SVG replaces the generated approximate mark; the split physical mark/wordmark is required by Kunora's source assets.
- Sidebar follows the formal 260px design token rather than the generated raster's approximately 274px.
- Real line-diff calculation corrects fabricated line alignment and the extra closing brace in the mock.
- Empty input disables Send, unlike the image. Explicit local-demo hints prevent confusing the simulator with a real agent.
- Manrope is bundled with its license. MiSans is requested locally with a system Chinese fallback; this host has Microsoft YaHei, not MiSans.

## Checks completed

File switching; close returns focus to the file button; read-tool expand; per-session draft retained after switching; desktop no document overflow; browser error/warning log empty.

Iteration 1 result: blocked; findings addressed below.

## Iteration 2 — corrections and regression checks

Fixed the four initial P2s: mobile uses keyboard-operable before/after tabs; sidebar/tool/file typography is 16/15/15px and code is 13px; icon buttons have explicit accessible names; code widths are derived from source content and scroll inside the detail panel. `qa/mobile-detail-final.png` shows the corrected readable mobile inspector. `qa/mobile-final.png` and `qa/tablet.png` show the conversation at 390×844 and 1024×768.

Additional P2s found during implementation review and corrected:

- `#687a96` small text had only 4.36:1 contrast on white. The text-only variant `#61728d` now measures 4.88:1 on white (and remains above 4.5:1 on canvas). The primary brand button is 9.83:1; secondary text 9.64:1.
- Selecting an empty workspace could leave the previous workspace's conversation visible. Workspace selection now selects a session in that workspace or creates a local blank session.
- Desktop Escape now closes details and returns focus to the triggering file; mobile tabs use arrows, selected tab semantics, Escape, and focus restoration.

An intermediate recapture exposed an unnecessary 24px horizontal overflow in the default diff. Reducing the conservative minimum code-column width removed it without clipping code. The final viewport reports detail scrollWidth = clientWidth = 655px.

## Final comparison

Source visual truth: `C:/Users/Administrator/code-projects/kunora-workbench/docs/workbench/harness-redesign-2026-08-31/concepts/03-file-comparison.png`.

Implementation screenshot: `C:/Users/Administrator/code-projects/kunora-workbench/prototypes/harness-workbench/qa/desktop-final.png`.

Both were reopened together as original-resolution images in the same final comparison input after the fixes. Source: 1487×1058 pixels. Implementation: 1487×1058 pixels, CSS viewport 1487×1058, devicePixelRatio 1. No cropping or density scaling. State: initial form session, empty composer, completed example turn, AssociateTask.tsx side-by-side detail open.

| Required surface | Final assessment |
|---|---|
| Fonts / typography | Manrope is loaded locally for Latin; Microsoft YaHei fallback is active for Chinese when MiSans is absent. Hierarchy/body wrapping are readable. Navigation density was corrected; the generated raster's larger title is moderated to an actual 18px UI heading. Font fallback remains documented P3 polish, not an undisclosed match claim. |
| Spacing / layout | Left blue navigation, center conversation and right paired diff match the selected hierarchy. 260px formal sidebar and slightly adjusted header spacing are intentional. Output files and composer retain their source grouping. Document width equals viewport at 1487, 1024, 390 and 320px. |
| Colors / tokens | Exact Kunora deep blue, white/canvas surfaces, subtle line colors, readable selected-file blue. Muted text adjusted for contrast; no decorative gradients or static panel shadows. State icons/text and diff +/- markers do not rely solely on color. |
| Assets / icons | Original unmodified brand mark and wordmark SVGs are proportionally rendered; Phosphor provides the consistent UI icon set. Source letter avatars remain text identity labels. No rasterized UI or invented brand drawing. |
| Copy / content | Selected Chinese request, summary, tools and file labels preserved. Real aligned text differences replace incorrect image code. Additional demo notices, disabled empty Send and failure messages are deliberate functional corrections. |

Focused review: the brand lockup, tool/file labels, composer controls and line-number/code area were scrutinized within the paired original-resolution captures. At 1487px these details were readable without a separate crop; mobile inspector has a dedicated 390px screenshot. The source has no mobile mock, so mobile screenshots are usability evidence, not claimed pixel matches.

## Verified interactions and limits

- Session navigation, text search, workspace expand/collapse and adding a separate example workspace.
- Draft remains associated with its session across navigation.
- File selection changes real diff text; expand/restore; close and Escape restore focus.
- Read-tool expansion exposes the sample file list.
- New session, input, send, busy state, success response, queue and stop.
- A simulated failed request restores original text while preserving newer input. Retry works. Stop restores queued text.
- Quick commands populate the draft. Settings dialog has native modal behavior and a working simulated-failure checkbox.
- Mobile navigation drawer; mobile before/after tabs and arrow-key switching; 44px primary controls; no document overflow at 320px. Reduced-motion CSS is present.
- Browser error and warning logs checked after final reload: empty. Vite production build passes. Four supplied packaging tests pass. Independent reconstruction checks preserve both versions of all three sample files plus empty diff.

Not verified / not claimed: real model/Harness connections, OS native file chooser selection, uploading, filesystem changes, authentication, persistence, screen-reader end-to-end testing, real-device software keyboard, full WCAG conformance, dark mode. These are outside the selected frontend-prototype scope. Attachment UI stores names only and never reads or uploads file contents.

## Follow-up polish

- P3: provide a properly licensed MiSans installation or approved webfont source for exact Chinese typography on all hosts.
- P3: run physical phone keyboard and screen-reader checks before turning this into production UI.

## Implementation checklist

- [x] Selected option 3 and original assets used.
- [x] Main interactions work with explicit local simulation.
- [x] Initial P2s corrected and recaptured.
- [x] Same-viewport final comparison, responsive checks and console checks completed.
- [x] Production build verified; no deployment or changes to the frozen dsh source.

No actionable P0/P1/P2 findings remain within the prototype scope.

Initial selected-concept implementation result: passed.

## Continuation — product name and secondary surfaces (2026-08-31)

Requested scope: exact product/window title `Kunora Workbench`; continue the selected design into new-session guidance, history, and settings. Original source assets and the existing conversation/diff remain intact. The old wordmark file is retained, while the user-requested product name is now UI text alongside the original mark.

### Visual comparison

The selected concept and `qa/continuation-conversation.png` were compared together at 1487×1058 (CSS viewport 1487×1058, DPR 1, measured sidebar 260px). The three-column hierarchy, tool rows, output-file selection, typography, composer, and diff remain consistent with the prior approved implementation. Intentional changes: product name in the top bar and sidebar, session context below the title, and a history entry above Settings. The earlier accepted differences from the generated source still apply. An initial capture taken during viewport resizing was rejected and replaced after layout settled.

`references/harness-original-settings.png` and `qa/continuation-settings-1280.png` were opened in the same comparison input at 1280×720. Both show the General settings dialog. This is a Kunora redesign, not a pixel clone: the original four-category navigation is preserved, the brand's 8–12px radii and blue selection replace the source's larger neutral pills, and functional controls are limited to the prototype's actual capabilities. Live permissions, connection configuration, and dark mode are not fabricated. The dialog's content and dimensions intentionally differ; its underlying session background is not identical.

New-session and history surfaces extend the selected code target and have no separate approved source mock. They use the existing colors, original mark, Manrope/system Chinese font stack, Phosphor icons, restrained borders, and clear local-demo copy. Screenshots are usability evidence, not claims of a pixel match.

### Issues found and fixed

- P2: Mobile settings categories needed horizontal scrolling. Replaced the narrow tab strip with a two-column grid; all four labels are visible at 320px.
- P2: The model status badge squeezed its explanation to a very narrow text column at 320px. A mobile grid now gives the explanation the remaining width and places the badge on its own row. Verified in `qa/continuation-models-320.png`.
- P2: History's initial search focus interfered with native focus restoration. Dialog launchers are now recorded explicitly, and dismissal restores the correct navigation control. Opening history focuses its search field.
- Inline rename Escape cancels the edit without dismissing history. Empty names cannot be saved. Archived rows explicitly say “恢复并打开” so reopening does not silently change archive state.

### Verified behavior

- Document title and top-bar heading equal `Kunora Workbench`.
- New-session suggestion appends to existing text and changes the selected demonstration mode; no automatic send.
- Search empty state and clear-search recovery; rename updates navigation and current-session context.
- Archiving the current session switches to another active session. Restore and reopen preserve the original draft plus appended suggestion.
- Agent preset creates a separate draft; the prior session's draft remains unchanged.
- Font size changes to 17px in the desktop editor. With Ctrl/Command+Enter selected, Enter inserts a newline and Control+Enter sends in the Windows browser. The macOS Command key was not separately tested.
- Simulated failure restores the sent text before the text entered while waiting. No real request occurs.
- All four settings panels open; arrow keys move selected tab and keyboard focus together.
- File switching and Escape focus return still work. Dialog dismissal returns focus to its launcher.
- Desktop 1487px, settings 1280px, tablet 1024px, and phone 390px/320px checked. No document or dialog horizontal overflow; the 320px Send button remains inside the viewport with a 44px height. Long dialogs and lists scroll internally.
- Browser error/warning logs empty after final reload. Production build and all four existing packaging tests pass. These packaging tests are not UI interaction tests; interaction checks were performed in the browser.

### Evidence and remaining limits

Screenshots: `qa/continuation-conversation.png`, `qa/continuation-new-session.png`, `qa/continuation-history.png`, `qa/continuation-settings.png`, `qa/continuation-settings-1280.png`, `qa/continuation-models.png`, `qa/continuation-new-session-mobile.png`, `qa/continuation-history-mobile.png`, `qa/continuation-settings-mobile.png`, `qa/continuation-models-320.png`, `qa/continuation-tablet.png`.

All state remains in page memory and resets on refresh. No model, plugin installation, file access, persistence, backend integration, deployment, or Git push was added. MiSans fallback and physical-device/screen-reader validation remain the earlier documented follow-up limitations. The current work changes only this independent prototype; existing unrelated workspace modifications are preserved.

No actionable P0/P1/P2 findings remain in this continuation's frontend-prototype scope.

First continuation result: passed.

## Second continuation — workspace management, session actions and file browser

Scope: extend the selected code target without changing its three-column conversation/diff experience. New surfaces use existing Kunora tokens and Phosphor icons. No additional raster assets, Figma files, backend connections, persistence, deployment or repository synchronization were introduced.

### Visual grounding and comparison

The selected `03-file-comparison.png` and `qa/next-conversation-final.png` were opened together in the same comparison input at 1487×1058, DPR 1. State: initial form conversation, blank composer and AssociateTask.tsx paired diff. Sidebar measured 260px. Message grouping, file cards, diff colors, line typography, spacing and composer remain consistent with the prior implementation. The right end of the top bar now contains file browsing and session actions in place of the static date; this is an intentional extension. Prior accepted brand/name and generated-code corrections still apply.

The workspace and file dialogs extend the approved design language rather than claiming a match to nonexistent source mocks. They use 8–10px component radii, white/canvas surfaces, brand-blue active controls, original brand assets, and restrained overlay shadows. Text explicitly distinguishes local demo groups, snapshots and files from real connected resources. Desktop file browsing uses a list/preview split; mobile uses two sequential views with a visible return control.

### Findings corrected during review

- P2: Narrow workspace statistics could split a label across lines, and the workspace list introduced nested scrolling. Statistics now wrap as complete items and the mobile dialog scrolls as a single surface. The add/edit control and second workspace's Open action were exercised at 320px.
- P2: A menu opened by keyboard did not reliably dismiss on Tab. It now explicitly dismisses and restores its trigger. Arrow-key navigation and Escape were also exercised; menu items use managed focus.
- Focus polish: workspace rename returns to a connected control even if its old row was replaced. Dialog dismissal now checks whether the original launcher remains visible instead of always returning to mobile navigation, which is necessary for the new top-bar file action.

### Browser verification

- Creating an existing workspace name with different casing shows an error and preserves input; whitespace-only names disable submission.
- Creating `visual-design`, adding an independent draft, and renaming it to `visual-review` preserved that draft and its association. Switching back restored the original workspace's draft.
- Session copy retained the original draft and messages. Editing the copy did not change the original. The copy's provenance is visible, and its title can be changed independently.
- Archive from the menu removes the session from active navigation; Undo restores it and its draft. While a reply is pending, Copy and Archive are disabled and the menu explains why.
- File name search, code/document filtering, empty-filter recovery, empty-session state, Markdown content and before/after selection work.
- Referencing a CSS file appended its name after existing draft text, with no send. Opening its diff selected the matching existing inspector. Escape returned focus to the top-bar file launcher.
- On mobile, choosing a file opens its preview and moves focus to its heading; Return restores focus to the chosen row. Opening the diff moves focus into its mobile inspector.
- Viewports checked: 1487×1058, 1024×768, 390×844 and 320×740. No document or dialog horizontal overflow. The 320px title fits; the action menu stays within the viewport. Both file actions are 44px high and fully inside the viewport. Code content may scroll horizontally inside its own preview.
- Browser warning/error logs empty after final reload. Production build and all four existing packaging tests pass. Packaging tests do not cover UI interactions; the behavior above was checked through the in-app browser.

Evidence: `qa/next-conversation-final.png`, `qa/next-workspaces.png`, `qa/next-session-menu.png`, `qa/next-files-desktop.png`, `qa/next-files-final.png`, `qa/next-files-mobile-list.png`, `qa/next-files-mobile-preview.png`, `qa/next-files-320.png`, `qa/next-workspaces-320.png`, `qa/next-files-tablet.png`.

Remaining limits: state resets on refresh; workspace groups are not real folders; copied sessions are not live agent forks or Git branches; file references contain names only; previewed content comes from the bundled sample payloads. Real backend/file/model access, screen-reader end-to-end testing and physical-device keyboards remain unverified. Existing unrelated workspace changes are retained.

No actionable P0/P1/P2 findings remain within this continuation's frontend-prototype scope.

final result: passed
