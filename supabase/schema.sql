-- ==============================================================================
-- KIMIYA TELECOM ENTERPRISE SYSTEM
-- SUPABASE POSTGRESQL PRODUCTION SCHEMA
-- Timezone: Africa/Addis_Ababa (+03:00)
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. BRANCHES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa')
);

-- ------------------------------------------------------------------------------
-- 2. USERS & RBAC TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'FINANCE', 'SHOP_USER')),
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa')
);

-- ------------------------------------------------------------------------------
-- 3. SCRATCH CARD DENOMINATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scratch_denominations (
    id VARCHAR(50) PRIMARY KEY,
    denomination_value INTEGER UNIQUE NOT NULL CHECK (denomination_value > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa')
);

-- ------------------------------------------------------------------------------
-- 4. CENTRAL STORE INVENTORY TABLE (Managed by Finance)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS central_stock (
    id VARCHAR(50) PRIMARY KEY,
    product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('SIM', 'SCRATCH_CARD')),
    denomination_id VARCHAR(50) REFERENCES scratch_denominations(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    low_stock_threshold INTEGER NOT NULL DEFAULT 500,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa'),
    CONSTRAINT uq_central_product_denom UNIQUE (product_type, denomination_id)
);

-- ------------------------------------------------------------------------------
-- 5. BRANCH INVENTORY TABLE (Per-Branch Retail Stock)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branch_stock (
    id VARCHAR(100) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('SIM', 'SCRATCH_CARD')),
    denomination_id VARCHAR(50) REFERENCES scratch_denominations(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    low_stock_threshold INTEGER NOT NULL DEFAULT 100,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa'),
    CONSTRAINT uq_branch_product_denom UNIQUE (branch_id, product_type, denomination_id)
);

-- ------------------------------------------------------------------------------
-- 6. STOCK INCOMING TABLE (Central Store Supplier Intake)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_incoming (
    id VARCHAR(50) PRIMARY KEY,
    product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('SIM', 'SCRATCH_CARD')),
    denomination_id VARCHAR(50) REFERENCES scratch_denominations(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
    total_cost NUMERIC(14, 2) NOT NULL CHECK (total_cost >= 0),
    supplier_name VARCHAR(100) NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    received_by_user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa')
);

-- ------------------------------------------------------------------------------
-- 7. STOCK TRANSFERS TABLE (Central Store -> Branch Transfer Lifecycle)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_transfers (
    id VARCHAR(50) PRIMARY KEY,
    product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('SIM', 'SCRATCH_CARD')),
    denomination_id VARCHAR(50) REFERENCES scratch_denominations(id) ON DELETE SET NULL,
    source_location VARCHAR(50) NOT NULL DEFAULT 'CENTRAL_STORE',
    destination_branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'APPROVED', 'REJECTED')),
    sent_by_user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa'),
    reviewed_by_user_id VARCHAR(50) REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason_code VARCHAR(50) CHECK (
        rejection_reason_code IS NULL OR 
        rejection_reason_code IN ('WRONG_QUANTITY', 'WRONG_DENOMINATION', 'WRONG_PRODUCT', 'ITEMS_NOT_RECEIVED', 'DAMAGED_STOCK', 'OTHER')
    ),
    rejection_reason_text TEXT,
    finance_review_status VARCHAR(20) CHECK (finance_review_status IS NULL OR finance_review_status IN ('PENDING', 'RESOLVED', 'CANCELLED', 'RESENT')),
    finance_review_notes TEXT,
    reference_transfer_id VARCHAR(50) REFERENCES stock_transfers(id) ON DELETE SET NULL,
    notes TEXT
);

-- ------------------------------------------------------------------------------
-- 8. IMMUTABLE STOCK LEDGER TABLE (Append-Only Inventory History)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_ledger (
    id VARCHAR(50) PRIMARY KEY,
    transaction_id VARCHAR(50) NOT NULL,
    product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('SIM', 'SCRATCH_CARD')),
    denomination_id VARCHAR(50) REFERENCES scratch_denominations(id) ON DELETE SET NULL,
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('SUPPLIER_INTAKE', 'SENT_TO_BRANCH', 'APPROVED', 'REJECTED', 'SALE', 'RECONCILIATION_ADJUSTMENT')),
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('SUPPLIER', 'CENTRAL_STORE', 'BRANCH')),
    source_id VARCHAR(50) NOT NULL,
    destination_type VARCHAR(20) NOT NULL CHECK (destination_type IN ('CENTRAL_STORE', 'BRANCH', 'CUSTOMER')),
    destination_id VARCHAR(50) NOT NULL,
    previous_quantity INTEGER NOT NULL,
    change_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa')
);

-- ------------------------------------------------------------------------------
-- 9. BUSINESS DAY SESSIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_sessions (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    opened_by_user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa'),
    opening_notes TEXT,
    closed_by_user_id VARCHAR(50) REFERENCES users(id),
    closed_at TIMESTAMPTZ,
    closing_notes TEXT,
    total_sim_sold INTEGER NOT NULL DEFAULT 0,
    total_scratch_sold INTEGER NOT NULL DEFAULT 0,
    total_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_expenses NUMERIC(14, 2) NOT NULL DEFAULT 0.00
);

-- ------------------------------------------------------------------------------
-- 10. SALES TABLE (Point-of-Sale Transactions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES business_sessions(id) ON DELETE CASCADE,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('SIM', 'SCRATCH_CARD')),
    denomination_id VARCHAR(50) REFERENCES scratch_denominations(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
    total_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    profit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_method = 'CASH'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa')
);

-- ------------------------------------------------------------------------------
-- 11. EXPENSES TABLE (Operating Costs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE SET NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('RENT', 'UTILITIES', 'SALARIES', 'TRANSPORT', 'OFFICE', 'MAINTENANCE', 'MARKETING', 'OTHER')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    date DATE NOT NULL,
    recorded_by_user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa')
);

-- ------------------------------------------------------------------------------
-- 12. SYSTEM NOTIFICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_notifications (
    id VARCHAR(50) PRIMARY KEY,
    recipient_user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    recipient_role VARCHAR(20) CHECK (recipient_role IN ('ADMIN', 'FINANCE', 'SHOP_USER')),
    recipient_branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('NEW_TRANSFER', 'TRANSFER_APPROVED', 'REVIEW_REQUIRED', 'LOW_STOCK', 'SESSION_ALERT', 'GENERAL')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    reference_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa')
);

-- ------------------------------------------------------------------------------
-- 13. IMMUTABLE AUDIT LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    actor_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(20),
    actor_branch_id VARCHAR(50),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa')
);

-- ------------------------------------------------------------------------------
-- 14. DATABASE BACKUPS METADATA TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS database_backups (
    id VARCHAR(50) PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'VERIFIED', 'FAILED')),
    created_by_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Addis_Ababa')
);

-- ------------------------------------------------------------------------------
-- 15. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_stock_transfers_dest ON stock_transfers(destination_branch_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_branch_stock_branch ON branch_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(session_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_business_sessions_branch_status ON business_sessions(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_txn ON stock_ledger(transaction_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON system_notifications(recipient_user_id, recipient_role, is_read);

-- ------------------------------------------------------------------------------
-- 16. PERMISSIONS & ROW LEVEL SECURITY CONFIGURATION
-- ------------------------------------------------------------------------------
ALTER TABLE business_sessions ADD COLUMN IF NOT EXISTS closing_override_by VARCHAR(50);

ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE scratch_denominations DISABLE ROW LEVEL SECURITY;
ALTER TABLE central_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE branch_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_incoming DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE business_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE database_backups DISABLE ROW LEVEL SECURITY;

