PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sap_code TEXT,
  contract_number TEXT,
  basket_number TEXT,
  default_pieces_per_pallet INTEGER NOT NULL DEFAULT 0 CHECK (default_pieces_per_pallet >= 0),
  show_in_analysis INTEGER NOT NULL DEFAULT 1 CHECK (show_in_analysis IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY,
  plu TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (plu)
);

-- The same PLU can be linked to several suppliers. This table is the future
-- source for supplier exceptions and alternative-supplier logic in Analysis.
CREATE TABLE IF NOT EXISTS position_suppliers (
  id INTEGER PRIMARY KEY,
  position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  sap_code TEXT,
  contract_number TEXT,
  basket_number TEXT,
  pieces_per_pallet INTEGER NOT NULL DEFAULT 0 CHECK (pieces_per_pallet >= 0),
  show_in_analysis INTEGER NOT NULL DEFAULT 1 CHECK (show_in_analysis IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (position_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_positions_category ON positions(category);
CREATE INDEX IF NOT EXISTS idx_position_suppliers_supplier ON position_suppliers(supplier_id);
