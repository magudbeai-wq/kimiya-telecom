const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = path.resolve(__dirname, '../data/kimiya.db');

async function seed() {
  console.log('[KIMIYA DB] Seeding database at:', DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

  db.transaction(() => {
    // 1. Branches
    const branches = [
      { id: 'BR-KAR', code: 'KAR', name: 'KARAMARDHA', location: 'Karamardha Zone, Main Road' },
      { id: 'BR-GAR', code: 'GAR', name: 'GARABCASE', location: 'Garabcase Commercial Center' },
      { id: 'BR-DUD1', code: 'DUD1', name: 'DUDIHIDE 1', location: 'Dudihide Avenue 1' },
      { id: 'BR-DUD2', code: 'DUD2', name: 'DUDIHIDE 2', location: 'Dudihide Junction Sector 2' },
    ];

    const insertBranch = db.prepare(`
      INSERT OR REPLACE INTO branches (id, code, name, location, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ACTIVE', datetime('now', '+3 hours'), datetime('now', '+3 hours'))
    `);

    for (const b of branches) {
      insertBranch.run(b.id, b.code, b.name, b.location);
    }
    console.log('[KIMIYA DB] Branches seeded.');

    // 2. Scratch Denominations (5, 10, 15, 20, 25, 50, 100 ETB)
    const denominations = [
      { id: 'DENOM-5', value: 5, order: 1 },
      { id: 'DENOM-10', value: 10, order: 2 },
      { id: 'DENOM-15', value: 15, order: 3 },
      { id: 'DENOM-20', value: 20, order: 4 },
      { id: 'DENOM-25', value: 25, order: 5 },
      { id: 'DENOM-50', value: 50, order: 6 },
      { id: 'DENOM-100', value: 100, order: 7 },
    ];

    const insertDenom = db.prepare(`
      INSERT OR REPLACE INTO scratch_denominations (id, denomination_value, is_active, display_order, created_at)
      VALUES (?, ?, 1, ?, datetime('now', '+3 hours'))
    `);

    for (const d of denominations) {
      insertDenom.run(d.id, d.value, d.order);
    }
    console.log('[KIMIYA DB] Scratch Denominations seeded.');

    // 3. Central Store Stock
    const insertCentralStock = db.prepare(`
      INSERT OR REPLACE INTO central_stock (
        id, product_type, denomination_id, quantity, cost_price, selling_price, low_stock_threshold, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))
    `);

    // SIM Cards in Central Store: 10,000 cards
    insertCentralStock.run('CS-SIM', 'SIM', null, 10000, 30.0, 50.0, 500);

    // Scratch Cards in Central Store
    const centralScratchStock = [
      { denomId: 'DENOM-5', qty: 10000, value: 5 },
      { denomId: 'DENOM-10', qty: 20000, value: 10 },
      { denomId: 'DENOM-15', qty: 5000, value: 15 },
      { denomId: 'DENOM-20', qty: 8000, value: 20 },
      { denomId: 'DENOM-25', qty: 5000, value: 25 },
      { denomId: 'DENOM-50', qty: 20000, value: 50 },
      { denomId: 'DENOM-100', qty: 2000, value: 100 },
    ];

    for (const item of centralScratchStock) {
      insertCentralStock.run(
        `CS-SC-${item.value}`,
        'SCRATCH_CARD',
        item.denomId,
        item.qty,
        item.value * 0.9,
        item.value,
        1000
      );
    }
    console.log('[KIMIYA DB] Central Store Stock seeded.');

    // 4. Branch Stock for all branches
    const insertBranchStock = db.prepare(`
      INSERT OR REPLACE INTO branch_stock (
        id, branch_id, product_type, denomination_id, quantity, cost_price, selling_price, low_stock_threshold, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))
    `);

    for (const b of branches) {
      // SIM stock per branch
      insertBranchStock.run(`BS-${b.id}-SIM`, b.id, 'SIM', null, 200, 30.0, 50.0, 100);

      // Scratch card stock per branch
      for (const d of denominations) {
        insertBranchStock.run(
          `BS-${b.id}-SC-${d.value}`,
          b.id,
          'SCRATCH_CARD',
          d.id,
          100,
          d.value * 0.9,
          d.value,
          50
        );
      }
    }
    console.log('[KIMIYA DB] Branch Stocks seeded for 4 branches.');

    // 5. Users
    const users = [
      {
        id: 'USER-ADMIN-01',
        username: 'admin',
        full_name: 'System Administrator',
        email: 'admin@kimiya.com',
        role: 'ADMIN',
        branch_id: null,
      },
      {
        id: 'USER-FINANCE-01',
        username: 'finance',
        full_name: 'Finance & Central Store Manager',
        email: 'finance@kimiya.com',
        role: 'FINANCE',
        branch_id: null,
      },
      {
        id: 'USER-SHOP-01',
        username: 'ahmed_kar',
        full_name: 'Ahmed Ali (Karamardha)',
        email: 'ahmed.kar@kimiya.com',
        role: 'SHOP_USER',
        branch_id: 'BR-KAR',
      },
      {
        id: 'USER-SHOP-02',
        username: 'fatima_gar',
        full_name: 'Fatima Hassan (Garabcase)',
        email: 'fatima.gar@kimiya.com',
        role: 'SHOP_USER',
        branch_id: 'BR-GAR',
      },
      {
        id: 'USER-SHOP-03',
        username: 'hassan_dud1',
        full_name: 'Hassan Mohamed (Dudihide 1)',
        email: 'hassan.dud1@kimiya.com',
        role: 'SHOP_USER',
        branch_id: 'BR-DUD1',
      },
      {
        id: 'USER-SHOP-04',
        username: 'omar_dud2',
        full_name: 'Omar Farah (Dudihide 2)',
        email: 'omar.dud2@kimiya.com',
        role: 'SHOP_USER',
        branch_id: 'BR-DUD2',
      },
    ];

    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (
        id, username, full_name, email, password_hash, role, branch_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now', '+3 hours'))
    `);

    for (const u of users) {
      insertUser.run(u.id, u.username, u.full_name, u.email, defaultPasswordHash, u.role, u.branch_id);
    }
    console.log('[KIMIYA DB] Users seeded.');

    // 6. System Settings
    const settings = [
      { key: 'COMPANY_NAME', value: 'KIMIYA TELECOM', desc: 'Official registered company name' },
      { key: 'DEFAULT_TIMEZONE', value: 'Africa/Addis_Ababa', desc: 'Primary operating timezone' },
      { key: 'CURRENCY_CODE', value: 'ETB', desc: 'Ethiopian Birr currency symbol' },
      { key: 'SIM_DEFAULT_SELLING_PRICE', value: '50.00', desc: 'Standard retail price for SIM Cards' },
      { key: 'SIM_DEFAULT_COST_PRICE', value: '30.00', desc: 'Wholesale acquisition cost for SIM Cards' },
      { key: 'BUSINESS_HOURS_OPEN', value: '08:00', desc: 'Default branch opening time' },
      { key: 'BUSINESS_HOURS_CLOSE', value: '20:00', desc: 'Default branch closing time' },
    ];

    const insertSetting = db.prepare(`
      INSERT OR REPLACE INTO system_settings (key, value, description, updated_at)
      VALUES (?, ?, ?, datetime('now', '+3 hours'))
    `);

    for (const s of settings) {
      insertSetting.run(s.key, s.value, s.desc);
    }
    console.log('[KIMIYA DB] System Settings seeded.');
  })();

  db.close();
  console.log('[KIMIYA DB] Seeding completed successfully!');
}

seed().catch(console.error);
