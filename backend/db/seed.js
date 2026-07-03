/* ──────────────────────────────────────────────────────────────
   SEED SCRIPT
   Populates the database with realistic fake data so you can
   see how the app looks with real content.

   Run with:  npm run seed
   ────────────────────────────────────────────────────────────── */

const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./schema');

async function seed() {
  /* Initialize the database (sql.js needs async setup) */
  await db.initDb();

  console.log('Seeding database...');

  /* Turn off auto-save during bulk inserts for speed */
  db.batchMode = true;

  /* ── Clear existing data ─────────────────────────────────── */
  db.exec('DELETE FROM expenses');
  db.exec('DELETE FROM projects');
  db.exec('DELETE FROM categories');
  db.exec('DELETE FROM refresh_tokens');
  db.exec('DELETE FROM users');

  /* ── Create demo users ───────────────────────────────────── */
  const passwordHash = await bcrypt.hash('password123', 12);

  const users = [
    { email: 'alex@example.com',   name: 'Alex Rivera' },
    { email: 'priya@example.com',  name: 'Priya Sharma' },
    { email: 'jordan@example.com', name: 'Jordan Chen' },
    { email: 'demo@ledgr.app',     name: 'Demo User' },
  ];

  const insertUser = db.prepare(
    'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)'
  );

  const userIds = [];
  for (const u of users) {
    const result = insertUser.run(u.email, u.name, passwordHash);
    userIds.push(result.lastInsertRowid);
  }

  console.log(`  Created ${users.length} users (all passwords: "password123")`);

  /* ── Categories per user ─────────────────────────────────── */
  const categoryDefs = [
    { name: 'Software',        color: '#8B5CF6', icon: 'monitor' },
    { name: 'Travel',          color: '#F59E0B', icon: 'plane' },
    { name: 'Office Supplies', color: '#10B981', icon: 'briefcase' },
    { name: 'Meals',           color: '#EF4444', icon: 'utensils' },
    { name: 'Marketing',       color: '#3B82F6', icon: 'megaphone' },
    { name: 'Equipment',       color: '#EC4899', icon: 'wrench' },
    { name: 'Education',       color: '#14B8A6', icon: 'book' },
    { name: 'Utilities',       color: '#6366F1', icon: 'zap' },
  ];

  const insertCat = db.prepare(
    'INSERT INTO categories (user_id, name, color, icon) VALUES (?, ?, ?, ?)'
  );

  const categoryMap = {};
  for (const userId of userIds) {
    categoryMap[userId] = [];
    for (const cat of categoryDefs) {
      const result = insertCat.run(userId, cat.name, cat.color, cat.icon);
      categoryMap[userId].push({ id: result.lastInsertRowid, ...cat });
    }
  }

  console.log(`  Created ${categoryDefs.length} categories per user`);

  /* ── Projects per user ───────────────────────────────────── */
  const projectDefs = [
    { name: 'Website Redesign',    client_name: 'Bloom Studios' },
    { name: 'Mobile App MVP',      client_name: 'FreshCart' },
    { name: 'Brand Identity',      client_name: 'NovaTech' },
    { name: 'Annual Tax Prep',     client_name: null },
    { name: 'E-commerce Migration', client_name: 'Threadline' },
  ];

  const insertProject = db.prepare(
    'INSERT INTO projects (user_id, name, client_name) VALUES (?, ?, ?)'
  );

  const projectMap = {};
  for (const userId of userIds) {
    projectMap[userId] = [];
    for (const proj of projectDefs) {
      const result = insertProject.run(userId, proj.name, proj.client_name);
      projectMap[userId].push(result.lastInsertRowid);
    }
  }

  console.log(`  Created ${projectDefs.length} projects per user`);

  /* ── Expenses ────────────────────────────────────────────── */
  const expenseTemplates = [
    { desc: 'Figma Pro subscription',         amount: 15.00,  catIdx: 0 },
    { desc: 'Adobe Creative Cloud',           amount: 54.99,  catIdx: 0 },
    { desc: 'GitHub Team plan',               amount: 4.00,   catIdx: 0 },
    { desc: 'Notion workspace',               amount: 10.00,  catIdx: 0 },
    { desc: 'Train ticket to client meeting',  amount: 67.50,  catIdx: 1 },
    { desc: 'Uber to airport',                amount: 34.20,  catIdx: 1 },
    { desc: 'Hotel — 2 nights in Brooklyn',    amount: 389.00, catIdx: 1 },
    { desc: 'Airfare LAX to SFO',             amount: 198.00, catIdx: 1 },
    { desc: 'Printer paper (500 sheets)',      amount: 12.99,  catIdx: 2 },
    { desc: 'Ink cartridges',                 amount: 42.50,  catIdx: 2 },
    { desc: 'Standing desk mat',              amount: 39.99,  catIdx: 2 },
    { desc: 'Sticky notes & pens',            amount: 8.75,   catIdx: 2 },
    { desc: 'Client lunch — Bloom Studios',    amount: 78.40,  catIdx: 3 },
    { desc: 'Coffee with collaborator',        amount: 11.25,  catIdx: 3 },
    { desc: 'Team dinner after launch',        amount: 142.00, catIdx: 3 },
    { desc: 'Working lunch at café',           amount: 16.90,  catIdx: 3 },
    { desc: 'Google Ads — April campaign',     amount: 250.00, catIdx: 4 },
    { desc: 'Instagram promoted post',         amount: 50.00,  catIdx: 4 },
    { desc: 'Business cards (500)',            amount: 45.00,  catIdx: 4 },
    { desc: 'Podcast sponsorship',            amount: 200.00, catIdx: 4 },
    { desc: 'USB-C hub',                      amount: 29.99,  catIdx: 5 },
    { desc: 'External SSD 1TB',               amount: 89.99,  catIdx: 5 },
    { desc: 'Webcam upgrade',                 amount: 64.99,  catIdx: 5 },
    { desc: 'Online course — Advanced React',  amount: 29.99,  catIdx: 6 },
    { desc: 'Design conference ticket',        amount: 199.00, catIdx: 6 },
    { desc: 'Internet bill — May',             amount: 65.00,  catIdx: 7 },
    { desc: 'Phone plan — May',               amount: 45.00,  catIdx: 7 },
    { desc: 'Co-working space day pass',       amount: 25.00,  catIdx: 7 },
  ];

  const insertExpense = db.prepare(`
    INSERT INTO expenses (user_id, amount, description, date, category_id, project_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let expenseCount = 0;

  for (const userId of userIds) {
    const cats = categoryMap[userId];
    const projs = projectMap[userId];

    for (let i = 0; i < 40; i++) {
      const template = expenseTemplates[i % expenseTemplates.length];

      /* Add slight price variation so it looks realistic */
      const variation = 1 + (((i * 7 + userId * 3) % 20) - 10) / 100;
      const amount = Math.round(template.amount * variation * 100) / 100;

      /* Spread dates across the last 90 days */
      const daysAgo = (i * 2 + (userId % 3)) % 90;
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const dateStr = date.toISOString().split('T')[0];

      const categoryId = cats[template.catIdx].id;
      const projectId = projs[i % projs.length];

      insertExpense.run(userId, amount, template.desc, dateStr, categoryId, projectId);
      expenseCount++;
    }
  }

  /* Turn auto-save back on and persist everything */
  db.batchMode = false;
  db.save();

  console.log(`  Created ${expenseCount} expenses`);
  console.log('\nDone! You can log in with:');
  console.log('  Email:    demo@ledgr.app');
  console.log('  Password: password123');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
