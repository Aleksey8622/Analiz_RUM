PRAGMA foreign_keys = ON;

-- One record for every Excel or SQL load. Deleting an import also deletes
-- all stock rows loaded by it.
CREATE TABLE IF NOT EXISTS data_imports (
  id INTEGER PRIMARY KEY,
  report_type TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('excel', 'sql', 'manual')),
  source_name TEXT NOT NULL,
  source_modified_at TEXT,
  report_date TEXT,
  content_hash TEXT,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_imports_report_hash
  ON data_imports(report_type, content_hash)
  WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_data_imports_latest
  ON data_imports(report_type, status, imported_at DESC);

CREATE TABLE IF NOT EXISTS workshop_stock (
  id INTEGER PRIMARY KEY,
  import_id INTEGER REFERENCES data_imports(id) ON DELETE CASCADE,
  material_number TEXT NOT NULL,
  plant TEXT NOT NULL DEFAULT '',
  batch TEXT NOT NULL DEFAULT '',
  warehouse TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  free_stock REAL NOT NULL DEFAULT 0,
  quality_stock REAL NOT NULL DEFAULT 0,
  blocked_stock REAL NOT NULL DEFAULT 0,
  material_type TEXT NOT NULL DEFAULT '',
  manufactured_at TEXT,
  shelf_life TEXT,
  last_movement_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(material_number)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_workshop_stock_material
  ON workshop_stock(material_number);
CREATE INDEX IF NOT EXISTS idx_workshop_stock_import
  ON workshop_stock(import_id);
CREATE INDEX IF NOT EXISTS idx_workshop_stock_location
  ON workshop_stock(plant, warehouse);

-- The application reads this view when it needs the "Производство" value.
-- Several batches/warehouses for one material are summed automatically.
CREATE VIEW IF NOT EXISTS workshop_production_totals AS
SELECT
  stock.material_number,
  SUM(stock.free_stock) AS production
FROM workshop_stock AS stock
WHERE stock.import_id = (
  SELECT imports.id
  FROM data_imports AS imports
  WHERE imports.report_type = 'workshop_stock' AND imports.status = 'completed'
  ORDER BY imports.imported_at DESC, imports.id DESC
  LIMIT 1
)
GROUP BY material_number;

CREATE TRIGGER IF NOT EXISTS workshop_stock_set_updated_at
AFTER UPDATE ON workshop_stock
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE workshop_stock
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
