PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bom_rows (
  id INTEGER PRIMARY KEY,
  import_id INTEGER NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
  level INTEGER,
  position TEXT,
  material_type TEXT,
  component_number TEXT NOT NULL,
  material_text TEXT,
  phantom_node TEXT,
  alternative_position TEXT,
  ranked_list INTEGER,
  alternative_group TEXT,
  main_plu TEXT,
  material_text_1 TEXT,
  node TEXT,
  component_qty REAL,
  base_unit TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supply_rows (
  id INTEGER PRIMARY KEY,
  import_id INTEGER NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
  week_or_debt TEXT,
  supply_remainder REAL,
  supplier_code TEXT,
  supplier_name TEXT,
  order_created_at TEXT,
  planned_delivery_at TEXT,
  delivered_at TEXT,
  order_number TEXT NOT NULL,
  item_code TEXT NOT NULL,
  item_name TEXT,
  ordered_qty REAL,
  delivered_qty REAL,
  order_type TEXT,
  deleted TEXT,
  return_flag TEXT,
  order_status TEXT,
  unit TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_stock (
  id INTEGER PRIMARY KEY,
  import_id INTEGER NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
  restricted_batch TEXT,
  warehouse_type TEXT,
  storage_bin TEXT,
  handling_unit TEXT,
  product TEXT NOT NULL,
  consolidation_group TEXT,
  product_description TEXT,
  quantity REAL,
  base_unit TEXT,
  movement_date TEXT,
  shelf_life TEXT,
  batch TEXT,
  stock_type TEXT,
  movement_time TEXT,
  top_handling_unit TEXT,
  document TEXT,
  parent_handling_unit TEXT,
  resource TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blocked_stock (
  id INTEGER PRIMARY KEY,
  import_id INTEGER NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
  restricted_batch TEXT,
  warehouse_type TEXT,
  storage_bin TEXT,
  handling_unit TEXT,
  product TEXT NOT NULL,
  consolidation_group TEXT,
  product_description TEXT,
  quantity REAL,
  base_unit TEXT,
  movement_date TEXT,
  shelf_life TEXT,
  batch TEXT,
  stock_type TEXT,
  movement_time TEXT,
  top_handling_unit TEXT,
  document TEXT,
  parent_handling_unit TEXT,
  resource TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bom_import_component ON bom_rows(import_id, component_number);
CREATE INDEX IF NOT EXISTS idx_supply_import_item ON supply_rows(import_id, item_code);
CREATE INDEX IF NOT EXISTS idx_warehouse_import_product ON warehouse_stock(import_id, product);
CREATE INDEX IF NOT EXISTS idx_blocked_import_product ON blocked_stock(import_id, product);

CREATE VIEW IF NOT EXISTS latest_bom_rows AS
SELECT rows.* FROM bom_rows AS rows
WHERE rows.import_id = (SELECT id FROM data_imports WHERE report_type = 'bom' AND status = 'completed' ORDER BY imported_at DESC, id DESC LIMIT 1);

CREATE VIEW IF NOT EXISTS latest_supply_rows AS
SELECT rows.* FROM supply_rows AS rows
WHERE rows.import_id = (SELECT id FROM data_imports WHERE report_type = 'supplies' AND status = 'completed' ORDER BY imported_at DESC, id DESC LIMIT 1);

CREATE VIEW IF NOT EXISTS latest_warehouse_stock AS
SELECT rows.* FROM warehouse_stock AS rows
WHERE rows.import_id = (SELECT id FROM data_imports WHERE report_type = 'warehouse_stock' AND status = 'completed' ORDER BY imported_at DESC, id DESC LIMIT 1);

CREATE VIEW IF NOT EXISTS latest_blocked_stock AS
SELECT rows.* FROM blocked_stock AS rows
WHERE rows.import_id = (SELECT id FROM data_imports WHERE report_type = 'blocked_stock' AND status = 'completed' ORDER BY imported_at DESC, id DESC LIMIT 1);
