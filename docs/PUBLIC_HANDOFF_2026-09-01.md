# Analysis Room: handoff after the 2026-09-01 session

This note intentionally contains no company paths, server names, user names,
report contents, material identifiers, database hashes, credentials, or business
figures. It is a technical continuation point for the next development session.

## Agreed working rules

1. Before each implementation step, describe the intended result and wait for
   explicit user confirmation.
2. Implement and verify one bounded step at a time.
3. Do not mark a step complete until it is checked in the real desktop app.
4. Preserve user data and unrelated work. Back up a database before structural
   changes.
5. Keep source-code delivery separate from operational data synchronization.
6. Never publish corporate report data, local configuration, database files,
   network paths, credentials, or diagnostic dumps to GitHub.

## Architecture agreed during the session

- SQLite is the local operational source of truth for imported report snapshots
  and permanent user-created records.
- Routine refresh keeps only the current report snapshot. Historical report
  files remain in the external archive and are loaded only on demand.
- Permanent records such as directory corrections and manual forecasts must not
  be deleted when report snapshots are replaced.
- Redux should retain meaningful UI state while navigating inside one device.
  Temporary UI state does not need to move between devices.
- The existing workbook-based synchronizer is the transport between two managed
  workstations. Publishing and receiving must remain versioned, transactional,
  bounded in size, and protected by backups.
- Application source changes and the operational SQLite snapshot are different
  payloads and must be handled deliberately.

## Work completed and verified

- The database was audited and backed up before cleanup.
- Orphaned imported report rows were removed on a verified copy and the cleaned
  database was applied only after validation.
- The active database became substantially smaller while permanent corrections
  remained present.
- Current report imports, stock totals, forecasts, and stock-day calculations
  were reported as loading correctly after cleanup.
- Lifecycle code was added so a current refresh replaces dated imported rows
  instead of continuously accumulating snapshots. This still needs final
  end-to-end acceptance after the current blocker is resolved.
- The BOM page was changed to query-only behavior: an empty query must not render
  the complete report.

## Current blocker: BOM rendering differs from verified source data

Expected behavior:

- A query by a root product code returns that complete source block, beginning
  at hierarchy level zero and ending immediately before the next level-zero row.
- A query by a component returns every complete root block containing it.
- Returned blocks retain the exact source row and column order.
- The complete BOM is not displayed before a query.

Evidence gathered:

- A read-only diagnostic compared the selected root block directly between the
  source workbook and SQLite.
- Both sources contained the same row sequence, hierarchy levels, component
  identifiers, and descriptions.
- Only the representation of an empty cell differed (`empty string` versus
  `null`); this is not a business-data mismatch.
- SQLite contained one active BOM import and one occurrence of the tested root
  block.
- The running UI nevertheless displayed a different row set and a different row
  count.
- The discrepancy remained after rebuilding, terminating Electron processes,
  launching without the desktop shortcut, and launching with the local Electron
  executable.
- Therefore the shortcut, source workbook selection, database cleanup, and raw
  database row order are not currently supported as causes.

Do not resume by rewriting the database or importer. The next task is to trace
the exact runtime IPC path used by the visible window:

1. Add a temporary, non-sensitive runtime marker to the BOM search handler.
2. Log or expose only: handler version, selected date, active import id, database
   file identity represented without its path, input query, result count, and a
   hash of the ordered result identifiers.
3. Add the same marker to the renderer response and verify that the visible
   window received it.
4. Compare the handler output with a direct invocation of the same search module
   against the same in-memory database connection.
5. Check for duplicate IPC handlers, stale preload code, another BrowserWindow,
   or a renderer using cached state instead of the returned IPC result.
6. Remove temporary diagnostics after identifying the boundary where the result
   changes.

No further database cleanup, schema migration, or broad installer should be run
until this runtime discrepancy is explained.

## Planned product stages after the blocker

1. Finish and accept current-versus-historical snapshot lifecycle behavior.
2. Move the editable working directory model fully into SQLite without losing
   existing corrections.
3. Introduce Redux-backed navigation state incrementally, screen by screen.
4. Validate the existing two-device synchronization cycle on a backup copy.
5. Correct supply-report fields and debt/week interpretation.
6. Build order creation and a replace-in-place spreadsheet export template.
7. Build delivery planning, reservation, pallet rounding, correction, and
   cancellation.
8. Reconcile planned deliveries with actual receipt states.
9. Add reviewed email drafts, not unattended sending.
10. Add user sessions and an audit trail only after the data model and device
    synchronization are stable.

## Next-device continuation

- First receive the latest published version through the existing synchronizer;
  do not overwrite newer local work.
- Back up the local project and SQLite database before receiving changes.
- Verify the real project folder, local configuration, Node runtime, launcher,
  and synchronization baseline on that device.
- Build and launch only after synchronization reports success.
- Resume from the BOM runtime tracing task above, not from database cleanup.
