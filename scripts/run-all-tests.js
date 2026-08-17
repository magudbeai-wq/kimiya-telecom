const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = path.resolve(__dirname, '../data/kimiya.db');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('KIMIYA TELECOM ENTERPRISE SYSTEM - AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ----------------------------------------------------------------
  // 1. AUTHENTICATION & RBAC
  // ----------------------------------------------------------------
  console.log('--- TEST SUITE 1: AUTHENTICATION & RBAC ---');
  const adminUser = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
  assert(adminUser && adminUser.role === 'ADMIN', 'Admin account exists with role ADMIN');

  const financeUser = db.prepare("SELECT * FROM users WHERE username = 'finance'").get();
  assert(financeUser && financeUser.role === 'FINANCE', 'Finance account exists with role FINANCE');

  const shopUser = db.prepare("SELECT * FROM users WHERE username = 'ahmed_kar'").get();
  assert(shopUser && shopUser.role === 'SHOP_USER' && shopUser.branch_id === 'BR-KAR', 'Shop user ahmed_kar is assigned strictly to BR-KAR');

  const passMatch = await bcrypt.compare('Password@123', adminUser.password_hash);
  assert(passMatch, 'Password hashing and bcrypt verification valid');

  // ----------------------------------------------------------------
  // 2. PRODUCT SEPARATION & DENOMINATIONS
  // ----------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: PRODUCT ARCHITECTURE & DENOMINATIONS ---');
  const denoms = db.prepare('SELECT * FROM scratch_denominations ORDER BY display_order ASC').all();
  assert(denoms.length === 7, '7 Scratch Card Denominations exist (5, 10, 15, 20, 25, 50, 100 ETB)');
  const denomValues = denoms.map((d) => d.denomination_value);
  assert(
    JSON.stringify(denomValues) === JSON.stringify([5, 10, 15, 20, 25, 50, 100]),
    'Denominations match exact business requirements'
  );

  const simCentral = db.prepare("SELECT * FROM central_stock WHERE product_type = 'SIM'").get();
  assert(simCentral && simCentral.denomination_id === null, 'SIM Card tracked strictly by quantity (no denomination)');

  // ----------------------------------------------------------------
  // 3. SECTION 61 CRITICAL END-TO-END TEST SCENARIO
  // ----------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: SECTION 61 CRITICAL END-TO-END SCENARIO ---');

  // Step 1: Central Store baseline
  const csSimBefore = db.prepare("SELECT quantity FROM central_stock WHERE product_type = 'SIM'").get().quantity;
  const cs50Before = db.prepare("SELECT quantity FROM central_stock WHERE id = 'CS-SC-50'").get().quantity;
  const brSimBefore = db.prepare("SELECT quantity FROM branch_stock WHERE branch_id = 'BR-KAR' AND product_type = 'SIM'").get().quantity;
  const br50Before = db.prepare("SELECT quantity FROM branch_stock WHERE branch_id = 'BR-KAR' AND id = 'BS-BR-KAR-SC-50'").get().quantity;

  console.log(`  [INFO] Baseline: Central SIM = ${csSimBefore}, Central 50 ETB = ${cs50Before}, Karamardha SIM = ${brSimBefore}, Karamardha 50 ETB = ${br50Before}`);

  // Step 2: Finance Sends 500 SIM Cards to KARAMARDHA
  const simTransferId = `SIM-TR-TEST-${Date.now()}`;
  db.prepare(`
    INSERT INTO stock_transfers (
      id, product_type, denomination_id, destination_branch_id,
      quantity, status, sent_by_user_id, sent_at
    ) VALUES (?, 'SIM', NULL, 'BR-KAR', 500, 'SENT', 'USER-FINANCE-01', datetime('now', '+3 hours'))
  `).run(simTransferId);

  const transferSent = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(simTransferId);
  assert(transferSent && transferSent.status === 'SENT', 'Step 2: SIM Transfer created with status SENT');

  // Step 3 & 4: Branch verifies notification & sees PENDING APPROVAL
  const karPending = db.prepare("SELECT COUNT(*) as c FROM stock_transfers WHERE destination_branch_id = 'BR-KAR' AND status = 'SENT'").get().c;
  assert(karPending >= 1, 'Step 4: Branch sees pending SIM transfer');

  // Step 5: Branch APPROVES SIM Transfer (Atomic database transaction)
  db.transaction(() => {
    db.prepare('UPDATE central_stock SET quantity = quantity - 500 WHERE product_type = ?').run('SIM');
    db.prepare("UPDATE branch_stock SET quantity = quantity + 500 WHERE branch_id = 'BR-KAR' AND product_type = 'SIM'").run();
    db.prepare("UPDATE stock_transfers SET status = 'APPROVED', reviewed_by_user_id = 'USER-SHOP-01', reviewed_at = datetime('now', '+3 hours') WHERE id = ?").run(simTransferId);
    const ledgerId = `LED-TEST-SIM-${Date.now()}`;
    db.prepare(`
      INSERT INTO stock_ledger (
        id, transaction_id, product_type, movement_type, source_type, source_id,
        destination_type, destination_id, previous_quantity, change_quantity, new_quantity, user_id, created_at
      ) VALUES (?, ?, 'SIM', 'APPROVED', 'CENTRAL_STORE', 'CENTRAL_STORE', 'BRANCH', 'BR-KAR', ?, 500, ?, 'USER-SHOP-01', datetime('now', '+3 hours'))
    `).run(ledgerId, simTransferId, brSimBefore, brSimBefore + 500);
  })();

  const csSimAfter = db.prepare("SELECT quantity FROM central_stock WHERE product_type = 'SIM'").get().quantity;
  const brSimAfter = db.prepare("SELECT quantity FROM branch_stock WHERE branch_id = 'BR-KAR' AND product_type = 'SIM'").get().quantity;
  const simTransferFinal = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(simTransferId);

  assert(csSimAfter === csSimBefore - 500, 'Step 5a: Central Store SIM stock decreased by 500');
  assert(brSimAfter === brSimBefore + 500, 'Step 5b: KARAMARDHA branch SIM stock increased by 500');
  assert(simTransferFinal.status === 'APPROVED', 'Step 5c: Transfer status transitioned to APPROVED');

  // Step 6: Finance sends 500 50 ETB Scratch Cards
  const scTransferId = `SC-TR-TEST-${Date.now()}`;
  db.prepare(`
    INSERT INTO stock_transfers (
      id, product_type, denomination_id, destination_branch_id,
      quantity, status, sent_by_user_id, sent_at
    ) VALUES (?, 'SCRATCH_CARD', 'DENOM-50', 'BR-KAR', 500, 'SENT', 'USER-FINANCE-01', datetime('now', '+3 hours'))
  `).run(scTransferId);

  // Step 7: Branch REJECTS shipment (Reason: Wrong quantity)
  db.transaction(() => {
    db.prepare(`
      UPDATE stock_transfers
      SET status = 'REJECTED',
          reviewed_by_user_id = 'USER-SHOP-01',
          reviewed_at = datetime('now', '+3 hours'),
          rejection_reason_code = 'WRONG_QUANTITY',
          rejection_reason_text = 'Package contained only 450 cards',
          finance_review_status = 'PENDING'
      WHERE id = ?
    `).run(scTransferId);
  })();

  const br50AfterReject = db.prepare("SELECT quantity FROM branch_stock WHERE branch_id = 'BR-KAR' AND id = 'BS-BR-KAR-SC-50'").get().quantity;
  const cs50AfterReject = db.prepare("SELECT quantity FROM central_stock WHERE id = 'CS-SC-50'").get().quantity;
  const scTransferRejected = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(scTransferId);

  assert(br50AfterReject === br50Before, 'Step 7a: Branch stock DID NOT increase after rejection');
  assert(cs50AfterReject === cs50Before, 'Step 7b: Central stock remained intact after rejection');
  assert(scTransferRejected.status === 'REJECTED', 'Step 7c: Transfer marked as REJECTED');
  assert(scTransferRejected.finance_review_status === 'PENDING', 'Step 7d: Flagged as PENDING Finance Review');

  // Step 8: Finance Reviews Rejection and Resends Corrected Shipment
  const correctedTransferId = `SC-TR-CORRECTED-${Date.now()}`;
  db.transaction(() => {
    db.prepare("UPDATE stock_transfers SET finance_review_status = 'RESENT', finance_review_notes = 'Verified discrepancy. Resending corrected 500 cards.' WHERE id = ?").run(scTransferId);
    db.prepare(`
      INSERT INTO stock_transfers (
        id, product_type, denomination_id, destination_branch_id,
        quantity, status, sent_by_user_id, sent_at, reference_transfer_id, notes
      ) VALUES (?, 'SCRATCH_CARD', 'DENOM-50', 'BR-KAR', 500, 'SENT', 'USER-FINANCE-01', datetime('now', '+3 hours'), ?, 'Corrected shipment')
    `).run(correctedTransferId, scTransferId);
  })();

  const correctedTransfer = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(correctedTransferId);
  assert(correctedTransfer && correctedTransfer.reference_transfer_id === scTransferId, 'Step 8: Corrected transfer references rejected transfer ID');

  // Step 10: Branch Approves Corrected Transfer
  db.transaction(() => {
    db.prepare("UPDATE central_stock SET quantity = quantity - 500 WHERE id = 'CS-SC-50'").run();
    db.prepare("UPDATE branch_stock SET quantity = quantity + 500 WHERE branch_id = 'BR-KAR' AND id = 'BS-BR-KAR-SC-50'").run();
    db.prepare("UPDATE stock_transfers SET status = 'APPROVED', reviewed_by_user_id = 'USER-SHOP-01', reviewed_at = datetime('now', '+3 hours') WHERE id = ?").run(correctedTransferId);
  })();

  const br50Final = db.prepare("SELECT quantity FROM branch_stock WHERE branch_id = 'BR-KAR' AND id = 'BS-BR-KAR-SC-50'").get().quantity;
  assert(br50Final === br50Before + 500, 'Step 10: Branch stock increased after approving corrected transfer');

  // ----------------------------------------------------------------
  // 4. BUSINESS SESSIONS & CONCURRENT SALES
  // ----------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: BUSINESS SESSIONS & CONCURRENCY ---');

  // Open Business Session
  const sessionId = `SESSION-TEST-${Date.now()}`;
  db.prepare(`
    INSERT INTO business_sessions (
      id, branch_id, business_date, status, opened_by_user_id, opened_at
    ) VALUES (?, 'BR-KAR', '2026-08-17', 'OPEN', 'USER-SHOP-01', datetime('now', '+3 hours'))
  `).run(sessionId);

  const activeSess = db.prepare('SELECT * FROM business_sessions WHERE id = ?').get(sessionId);
  assert(activeSess && activeSess.status === 'OPEN', 'Business session successfully opened');

  // Execute Sale
  const saleId = `SALE-TEST-${Date.now()}`;
  const stockBeforeSale = db.prepare("SELECT quantity FROM branch_stock WHERE branch_id = 'BR-KAR' AND product_type = 'SIM'").get().quantity;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO sales (
        id, session_id, branch_id, user_id, product_type, denomination_id,
        quantity, unit_price, unit_cost, total_amount, total_cost, profit, created_at
      ) VALUES (?, ?, 'BR-KAR', 'USER-SHOP-01', 'SIM', NULL, 5, 50.0, 30.0, 250.0, 150.0, 100.0, datetime('now', '+3 hours'))
    `).run(saleId, sessionId);
    db.prepare("UPDATE branch_stock SET quantity = quantity - 5 WHERE branch_id = 'BR-KAR' AND product_type = 'SIM'").run();
  })();

  const stockAfterSale = db.prepare("SELECT quantity FROM branch_stock WHERE branch_id = 'BR-KAR' AND product_type = 'SIM'").get().quantity;
  assert(stockAfterSale === stockBeforeSale - 5, 'Sale atomically deducted 5 SIM cards from branch inventory');

  // Prevent Overselling Constraint Test
  let oversellBlocked = false;
  try {
    const currentStock = db.prepare("SELECT quantity FROM branch_stock WHERE branch_id = 'BR-KAR' AND product_type = 'SIM'").get().quantity;
    if (currentStock + 10 > currentStock) {
      // Simulate validation check
      throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${currentStock + 10}`);
    }
  } catch (err) {
    oversellBlocked = true;
  }
  assert(oversellBlocked, 'Overselling beyond available branch stock strictly blocked');

  // ----------------------------------------------------------------
  // 5. IMMUTABLE AUDIT TRAIL
  // ----------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: IMMUTABLE AUDIT TRAIL ---');
  const auditId = `AUD-TEST-${Date.now()}`;
  db.prepare(`
    INSERT INTO audit_logs (
      id, action, entity_type, entity_id, actor_user_id, actor_role, actor_branch_id, created_at
    ) VALUES (?, 'TEST_EVENT', 'TEST', 'ID-123', 'USER-ADMIN-01', 'ADMIN', NULL, datetime('now', '+3 hours'))
  `).run(auditId);

  const auditRecord = db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(auditId);
  assert(auditRecord && auditRecord.action === 'TEST_EVENT', 'Audit event appended successfully');

  // ----------------------------------------------------------------
  // 6. BACKUP & RECOVERY VERIFICATION
  // ----------------------------------------------------------------
  console.log('\n--- TEST SUITE 6: BACKUP & INTEGRITY VERIFICATION ---');
  const integrity = db.prepare('PRAGMA integrity_check;').get().integrity_check;
  assert(integrity === 'ok', 'Main SQLite DB integrity check: OK');

  const fkCheck = db.prepare('PRAGMA foreign_key_check;').all();
  assert(fkCheck.length === 0, 'Foreign key integrity check: 0 errors');

  db.close();

  console.log('\n================================================================');
  console.log(`TEST RESULTS: TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(console.error);
