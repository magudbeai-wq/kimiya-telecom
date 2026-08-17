-- ==============================================================================
-- KIMIYA TELECOM - PRODUCTION DATABASE SCHEMA
-- Enterprise Telecom Distribution, Inventory, Sales, Finance & Branch Management
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. BRANCHES
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DISABLED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours'))
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'FINANCE', 'SHOP_USER')),
  branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DISABLED')),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours'))
);

-- 3. SCRATCH DENOMINATIONS (5, 10, 15, 20, 25, 50, 100 ETB)
CREATE TABLE IF NOT EXISTS scratch_denominations (
  id TEXT PRIMARY KEY,
  denomination_value INTEGER UNIQUE NOT NULL CHECK(denomination_value > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours'))
);

-- 4. CENTRAL STORE STOCK (HEAD OFFICE)
CREATE TABLE IF NOT EXISTS central_stock (
  id TEXT PRIMARY KEY,
  product_type TEXT NOT NULL CHECK(product_type IN ('SIM', 'SCRATCH_CARD')),
  denomination_id TEXT REFERENCES scratch_denominations(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  cost_price REAL NOT NULL DEFAULT 0.0,
  selling_price REAL NOT NULL DEFAULT 0.0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 500,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  UNIQUE(product_type, denomination_id)
);

-- 5. BRANCH STOCK
CREATE TABLE IF NOT EXISTS branch_stock (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_type TEXT NOT NULL CHECK(product_type IN ('SIM', 'SCRATCH_CARD')),
  denomination_id TEXT REFERENCES scratch_denominations(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  cost_price REAL NOT NULL DEFAULT 0.0,
  selling_price REAL NOT NULL DEFAULT 0.0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 100,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  UNIQUE(branch_id, product_type, denomination_id)
);

-- 6. STOCK TRANSFERS (CENTRAL STORE -> BRANCH ONLY)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id TEXT PRIMARY KEY, -- e.g. SIM-TR-20260817-0001 or SC-TR-20260817-0001
  product_type TEXT NOT NULL CHECK(product_type IN ('SIM', 'SCRATCH_CARD')),
  denomination_id TEXT REFERENCES scratch_denominations(id) ON DELETE RESTRICT,
  destination_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  status TEXT NOT NULL DEFAULT 'SENT' CHECK(status IN ('SENT', 'APPROVED', 'REJECTED', 'CANCELLED')),
  sent_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at TEXT,
  rejection_reason_code TEXT CHECK(rejection_reason_code IN ('WRONG_QUANTITY', 'WRONG_DENOMINATION', 'WRONG_PRODUCT', 'ITEMS_NOT_RECEIVED', 'DAMAGED_STOCK', 'OTHER') OR rejection_reason_code IS NULL),
  rejection_reason_text TEXT,
  finance_review_status TEXT CHECK(finance_review_status IN ('PENDING', 'RESOLVED', 'RESENT', 'CANCELLED') OR finance_review_status IS NULL),
  finance_review_notes TEXT,
  reference_transfer_id TEXT REFERENCES stock_transfers(id) ON DELETE RESTRICT,
  notes TEXT
);

-- 7. INCOMING STOCK (SUPPLIER -> CENTRAL STORE)
CREATE TABLE IF NOT EXISTS incoming_stock (
  id TEXT PRIMARY KEY, -- e.g. IN-SIM-20260817-0001 or IN-SC-20260817-0001
  product_type TEXT NOT NULL CHECK(product_type IN ('SIM', 'SCRATCH_CARD')),
  denomination_id TEXT REFERENCES scratch_denominations(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_cost REAL NOT NULL CHECK(unit_cost >= 0.0),
  total_cost REAL NOT NULL CHECK(total_cost >= 0.0),
  supplier_name TEXT NOT NULL,
  reference_number TEXT NOT NULL,
  received_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  received_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  notes TEXT
);

-- 8. BUSINESS SESSIONS
CREATE TABLE IF NOT EXISTS business_sessions (
  id TEXT PRIMARY KEY, -- e.g. SESSION-20260817-KAR-0001
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  business_date TEXT NOT NULL, -- YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED')),
  opened_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opened_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  closed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  closed_at TEXT,
  opening_notes TEXT,
  closing_notes TEXT,
  total_sim_sold INTEGER NOT NULL DEFAULT 0,
  total_scratch_sold INTEGER NOT NULL DEFAULT 0,
  total_revenue REAL NOT NULL DEFAULT 0.0,
  total_expenses REAL NOT NULL DEFAULT 0.0,
  closing_override_by TEXT REFERENCES users(id) ON DELETE RESTRICT
);

-- 9. SALES (NO CREDIT / NO CUSTOMER DEBT)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY, -- e.g. SALE-20260817-0001
  session_id TEXT NOT NULL REFERENCES business_sessions(id) ON DELETE RESTRICT,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_type TEXT NOT NULL CHECK(product_type IN ('SIM', 'SCRATCH_CARD')),
  denomination_id TEXT REFERENCES scratch_denominations(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price REAL NOT NULL CHECK(unit_price >= 0.0),
  unit_cost REAL NOT NULL CHECK(unit_cost >= 0.0),
  total_amount REAL NOT NULL CHECK(total_amount >= 0.0),
  total_cost REAL NOT NULL CHECK(total_cost >= 0.0),
  profit REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours'))
);

-- 10. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, -- e.g. EXP-20260817-0001
  branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK(category IN ('RENT', 'UTILITIES', 'SALARIES', 'TRANSPORT', 'OFFICE', 'MAINTENANCE', 'MARKETING', 'OTHER')),
  amount REAL NOT NULL CHECK(amount > 0.0),
  description TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  date TEXT NOT NULL, -- YYYY-MM-DD
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  notes TEXT
);

-- 11. STOCK LEDGER (IMMUTABLE RECORD OF ALL INVENTORY MOVEMENTS)
CREATE TABLE IF NOT EXISTS stock_ledger (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK(product_type IN ('SIM', 'SCRATCH_CARD')),
  denomination_id TEXT REFERENCES scratch_denominations(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('INCOMING', 'SENT_TO_BRANCH', 'APPROVED', 'REJECTED', 'SALE', 'CORRECTION', 'REVERSAL')),
  source_type TEXT NOT NULL CHECK(source_type IN ('SUPPLIER', 'CENTRAL_STORE', 'BRANCH')),
  source_id TEXT NOT NULL,
  destination_type TEXT NOT NULL CHECK(destination_type IN ('CENTRAL_STORE', 'BRANCH', 'CUSTOMER')),
  destination_id TEXT NOT NULL,
  previous_quantity INTEGER NOT NULL,
  change_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours'))
);

-- 12. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  recipient_role TEXT CHECK(recipient_role IN ('ADMIN', 'FINANCE', 'SHOP_USER') OR recipient_role IS NULL),
  recipient_branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('TRANSFER_SENT', 'TRANSFER_APPROVED', 'TRANSFER_REJECTED', 'REVIEW_REQUIRED', 'LOW_STOCK', 'UNUSUAL_ACTIVITY', 'SESSION_OPENED', 'SESSION_CLOSED', 'SYSTEM')),
  reference_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours'))
);

-- 13. AUDIT LOGS (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_role TEXT NOT NULL,
  actor_branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
  ip_address TEXT,
  old_values TEXT, -- JSON
  new_values TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours'))
);

-- 14. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours'))
);

-- 15. BACKUPS RECORD
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  record_counts TEXT NOT NULL, -- JSON
  checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK(status IN ('SUCCESS', 'VERIFIED', 'FAILED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours'))
);

-- INDEXES FOR MAXIMUM QUERY PERFORMANCE & CONSTRAINTS
CREATE INDEX IF NOT EXISTS idx_users_role_branch ON users(role, branch_id);
CREATE INDEX IF NOT EXISTS idx_central_stock_lookup ON central_stock(product_type, denomination_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_lookup ON branch_stock(branch_id, product_type, denomination_id);
CREATE INDEX IF NOT EXISTS idx_transfers_dest_status ON stock_transfers(destination_branch_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_sessions_branch_date ON business_sessions(branch_id, business_date, status);
CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(session_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_type, denomination_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses(branch_id, date);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON stock_ledger(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_product ON stock_ledger(product_type, denomination_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, recipient_role, recipient_branch_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id, created_at);
