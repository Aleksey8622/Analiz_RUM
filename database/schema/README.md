SQLite schema and table definitions for Analiz_RUM.

- `items_directory.sql` — suppliers, positions and their relationships.
- `workshop_stock.sql` — workshop stock rows, import history and the aggregated
  `workshop_production_totals` view used by the `Производство` column.
- `sap_reports.sql` — BOM, supplies, warehouse stock and blocked stock snapshots.
- `analytics.sql` — stock totals, active/corrected supplies and the unified
  material stock view consumed by Analysis.

Every daily file is stored as an immutable import snapshot. `latest_*` views
expose only the newest successfully completed import to the application, while
older imports remain available for audit or explicit deletion.

All database writes must be performed in the Electron main process. The React
renderer calls typed IPC methods and never receives a raw database connection.
