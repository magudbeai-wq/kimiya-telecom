export type UserRole = 'ADMIN' | 'FINANCE' | 'SHOP_USER';

export type ProductType = 'SIM' | 'SCRATCH_CARD';

export type TransferStatus = 'SENT' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type FinanceReviewStatus = 'PENDING' | 'RESOLVED' | 'RESENT' | 'CANCELLED';

export type SessionStatus = 'OPEN' | 'CLOSED';

export type MovementType =
  | 'INCOMING'
  | 'SENT_TO_BRANCH'
  | 'APPROVED'
  | 'REJECTED'
  | 'SALE'
  | 'CORRECTION'
  | 'REVERSAL';

export type SourceDestinationType = 'SUPPLIER' | 'CENTRAL_STORE' | 'BRANCH' | 'CUSTOMER';

export type RejectionReasonCode =
  | 'WRONG_QUANTITY'
  | 'WRONG_DENOMINATION'
  | 'WRONG_PRODUCT'
  | 'ITEMS_NOT_RECEIVED'
  | 'DAMAGED_STOCK'
  | 'OTHER';

export type ExpenseCategory =
  | 'RENT'
  | 'UTILITIES'
  | 'SALARIES'
  | 'TRANSPORT'
  | 'OFFICE'
  | 'MAINTENANCE'
  | 'MARKETING'
  | 'OTHER';

export type NotificationType =
  | 'TRANSFER_SENT'
  | 'TRANSFER_APPROVED'
  | 'TRANSFER_REJECTED'
  | 'REVIEW_REQUIRED'
  | 'LOW_STOCK'
  | 'UNUSUAL_ACTIVITY'
  | 'SESSION_OPENED'
  | 'SESSION_CLOSED'
  | 'SYSTEM';

export interface Branch {
  id: string;
  code: string;
  name: string;
  location: string;
  status: 'ACTIVE' | 'DISABLED';
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  branch_id: string | null;
  branch_name?: string | null;
  branch_code?: string | null;
  status: 'ACTIVE' | 'DISABLED';
  last_login_at: string | null;
  created_at: string;
}

export interface ScratchDenomination {
  id: string;
  denomination_value: number; // e.g. 5, 10, 15, 20, 25, 50, 100
  is_active: number; // 1 or 0
  display_order: number;
  created_at: string;
}

export interface CentralStock {
  id: string;
  product_type: ProductType;
  denomination_id: string | null;
  denomination_value?: number | null;
  quantity: number;
  cost_price: number;
  selling_price: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface BranchStock {
  id: string;
  branch_id: string;
  branch_name?: string;
  branch_code?: string;
  product_type: ProductType;
  denomination_id: string | null;
  denomination_value?: number | null;
  quantity: number;
  cost_price: number;
  selling_price: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface StockTransfer {
  id: string; // e.g. SIM-TR-20260817-0001 or SC-TR-20260817-0001
  product_type: ProductType;
  denomination_id: string | null;
  denomination_value?: number | null;
  destination_branch_id: string;
  destination_branch_name?: string;
  destination_branch_code?: string;
  quantity: number;
  status: TransferStatus;
  sent_by_user_id: string;
  sent_by_user_name?: string;
  sent_at: string;
  reviewed_by_user_id: string | null;
  reviewed_by_user_name?: string | null;
  reviewed_at: string | null;
  rejection_reason_code: RejectionReasonCode | null;
  rejection_reason_text: string | null;
  finance_review_status: FinanceReviewStatus | null;
  finance_review_notes: string | null;
  reference_transfer_id: string | null;
  notes: string | null;
}

export interface IncomingStock {
  id: string; // e.g. IN-SIM-20260817-0001 or IN-SC-20260817-0001
  product_type: ProductType;
  denomination_id: string | null;
  denomination_value?: number | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  supplier_name: string;
  reference_number: string;
  received_by_user_id: string;
  received_by_user_name?: string;
  received_at: string;
  notes: string | null;
}

export interface BusinessSession {
  id: string; // e.g. SESSION-20260817-KAR-0001
  branch_id: string;
  branch_name?: string;
  branch_code?: string;
  business_date: string; // YYYY-MM-DD
  status: SessionStatus;
  opened_by_user_id: string;
  opened_by_user_name?: string;
  opened_at: string;
  closed_by_user_id: string | null;
  closed_by_user_name?: string | null;
  closed_at: string | null;
  opening_notes: string | null;
  closing_notes: string | null;
  total_sim_sold: number;
  total_scratch_sold: number;
  total_revenue: number;
  total_expenses: number;
  closing_override_by: string | null;
}

export interface Sale {
  id: string; // e.g. SALE-20260817-0001
  session_id: string;
  branch_id: string;
  branch_name?: string;
  branch_code?: string;
  user_id: string;
  user_name?: string;
  product_type: ProductType;
  denomination_id: string | null;
  denomination_value?: number | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total_amount: number;
  total_cost: number;
  profit: number;
  created_at: string;
}

export interface Expense {
  id: string; // e.g. EXP-20260817-0001
  branch_id: string | null; // null for Head Office
  branch_name?: string | null;
  branch_code?: string | null;
  category: ExpenseCategory;
  amount: number;
  description: string;
  created_by_user_id: string;
  created_by_user_name?: string;
  date: string; // YYYY-MM-DD
  created_at: string;
  notes: string | null;
}

export interface StockLedgerEntry {
  id: string;
  transaction_id: string;
  product_type: ProductType;
  denomination_id: string | null;
  denomination_value?: number | null;
  movement_type: MovementType;
  source_type: SourceDestinationType;
  source_id: string;
  destination_type: SourceDestinationType;
  destination_id: string;
  previous_quantity: number;
  change_quantity: number;
  new_quantity: number;
  user_id: string;
  user_name?: string;
  notes: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_user_id: string | null;
  recipient_role: UserRole | null;
  recipient_branch_id: string | null;
  title: string;
  message: string;
  type: NotificationType;
  reference_id: string | null;
  is_read: number; // 0 or 1
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_user_id: string;
  actor_user_name?: string;
  actor_role: string;
  actor_branch_id: string | null;
  actor_branch_name?: string | null;
  ip_address: string | null;
  old_values: string | null; // JSON string
  new_values: string | null; // JSON string
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: string;
  description: string;
  updated_by: string | null;
  updated_at: string;
}

export interface BackupRecord {
  id: string;
  file_name: string;
  file_size_bytes: number;
  record_counts: string; // JSON string
  checksum: string;
  status: 'SUCCESS' | 'VERIFIED' | 'FAILED';
  created_at: string;
}

export interface AuthSessionUser {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  branch_id: string | null;
  branch_name: string | null;
  branch_code: string | null;
}
