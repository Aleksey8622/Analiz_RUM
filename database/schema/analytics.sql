PRAGMA foreign_keys = ON;


CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS directory_positions (
  id INTEGER PRIMARY KEY,
  import_id INTEGER NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  plu TEXT NOT NULL,
  name TEXT NOT NULL,
  supplier TEXT NOT NULL DEFAULT '',
  supplier_sap_code TEXT NOT NULL DEFAULT '',
  contract_number TEXT NOT NULL DEFAULT '',
  basket_number TEXT NOT NULL DEFAULT '',
  pieces_per_pallet INTEGER NOT NULL DEFAULT 0,
  show_in_analysis INTEGER NOT NULL DEFAULT 1,
  sleeve_format TEXT,
  sleeve_client TEXT,
  sleeve_print_run INTEGER,
  deleted_override TEXT,
  UNIQUE(import_id, guid)
);

CREATE INDEX IF NOT EXISTS idx_directory_positions_import_plu ON directory_positions(import_id, plu);

-- A correction is a persistent business decision. It is keyed by the SAP
-- order and item, so it remains applicable after the next daily import.
CREATE TABLE IF NOT EXISTS supply_corrections (
  id INTEGER PRIMARY KEY,
  order_number TEXT NOT NULL,
  item_code TEXT NOT NULL,
  correction_type TEXT NOT NULL
    CHECK (correction_type IN ('completed_zero', 'not_orderable_remainder', 'manual')),
  original_remainder REAL NOT NULL DEFAULT 0,
  corrected_remainder REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (order_number, item_code, correction_type)
);

CREATE INDEX IF NOT EXISTS idx_supply_corrections_active
  ON supply_corrections(order_number, item_code, is_active);

CREATE TRIGGER IF NOT EXISTS supply_corrections_set_updated_at
AFTER UPDATE ON supply_corrections
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE supply_corrections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- One product may occupy many storage bins. Analytics needs their total.
CREATE VIEW IF NOT EXISTS warehouse_stock_totals AS
SELECT
  product AS material_number,
  SUM(quantity) AS warehouse_stock
FROM latest_warehouse_stock
GROUP BY product;

CREATE VIEW IF NOT EXISTS blocked_stock_totals AS
SELECT
  product AS material_number,
  SUM(quantity) AS blocked_stock
FROM latest_blocked_stock
GROUP BY product;

-- Rows with zero remainder are considered completed. A manually excluded
-- pallet remainder is also hidden from active supplies while its source row
-- remains untouched and auditable.
CREATE VIEW IF NOT EXISTS active_supply_rows AS
SELECT supplies.*
FROM latest_supply_rows AS supplies
WHERE COALESCE(supplies.supply_remainder, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM supply_corrections AS corrections
    WHERE corrections.order_number = supplies.order_number
      AND corrections.item_code = supplies.item_code
      AND corrections.is_active = 1
  );

CREATE VIEW IF NOT EXISTS supply_correction_rows AS
SELECT
  supplies.*,
  CASE
    WHEN COALESCE(supplies.supply_remainder, 0) = 0 THEN 'completed_zero'
    ELSE corrections.correction_type
  END AS correction_type,
  corrections.reason AS correction_reason,
  corrections.corrected_remainder
FROM latest_supply_rows AS supplies
LEFT JOIN supply_corrections AS corrections
  ON corrections.order_number = supplies.order_number
 AND corrections.item_code = supplies.item_code
 AND corrections.is_active = 1
WHERE COALESCE(supplies.supply_remainder, 0) = 0 OR corrections.id IS NOT NULL;

-- Unified stock source for the Analysis page. FULL OUTER JOIN is expressed
-- through a key union because SQLite does not provide it on older versions.
CREATE VIEW IF NOT EXISTS material_stock_totals AS
WITH materials AS (
  SELECT material_number FROM workshop_production_totals
  UNION SELECT material_number FROM warehouse_stock_totals
  UNION SELECT material_number FROM blocked_stock_totals
)
SELECT
  materials.material_number,
  COALESCE(warehouse.warehouse_stock, 0) AS warehouse_stock,
  COALESCE(workshop.production, 0) AS production_stock,
  COALESCE(blocked.blocked_stock, 0) AS blocked_stock,
  COALESCE(warehouse.warehouse_stock, 0) + COALESCE(workshop.production, 0) AS total_available_stock
FROM materials
LEFT JOIN warehouse_stock_totals AS warehouse USING (material_number)
LEFT JOIN workshop_production_totals AS workshop USING (material_number)
LEFT JOIN blocked_stock_totals AS blocked USING (material_number);
