const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./schema');

async function seed() {
  await db.initDb();

  console.log('Seeding database...');

  await db.query('DELETE FROM expenses');
  await db.query('DELETE FROM budgets');
  await db.query('DELETE FROM projects');
  await db.query('DELETE FROM categories');
  await db.query('DELETE FROM refresh_tokens');
  await db.query('DELETE FROM password_reset_tokens');
  await db.query('DELETE FROM users');

  const passwordHash = await bcrypt.hash('password123', 12);

  const users = [
    { email: 'alex@example.com',   name: 'Alex Rivera' },
    { email: 'priya@example.com',  name: 'Priya Sharma' },
    { email: 'jordan@example.com', name: 'Jordan Chen' },
    { email: 'demo@montraq.app',     name: 'Demo User' },
  ];

  const userIds = [];
  for (const u of users) {
    const { rows } = await db.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [u.email, u.name, passwordHash]
    );
    userIds.push(rows[0].id);
  }

  console.log(`  Created ${users.length} users (all passwords: "password123")`);

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

  const categoryMap = {};
  for (const userId of userIds) {
    categoryMap[userId] = [];
    for (const cat of categoryDefs) {
      const { rows } = await db.query(
        'INSERT INTO categories (user_id, name, color, icon) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, cat.name, cat.color, cat.icon]
      );
      categoryMap[userId].push({ id: rows[0].id, ...cat });
    }
  }

  console.log(`  Created ${categoryDefs.length} categories per user`);

  const projectDefs = [
    { name: 'Website Redesign',    client_name: 'Bloom Studios' },
    { name: 'Mobile App MVP',      client_name: 'FreshCart' },
    { name: 'Brand Identity',      client_name: 'NovaTech' },
    { name: 'Annual Tax Prep',     client_name: null },
    { name: 'E-commerce Migration', client_name: 'Threadline' },
  ];

  const projectMap = {};
  for (const userId of userIds) {
    projectMap[userId] = [];
    for (const proj of projectDefs) {
      const { rows } = await db.query(
        'INSERT INTO projects (user_id, name, client_name) VALUES ($1, $2, $3) RETURNING id',
        [userId, proj.name, proj.client_name]
      );
      projectMap[userId].push(rows[0].id);
    }
  }

  console.log(`  Created ${projectDefs.length} projects per user`);

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

  let expenseCount = 0;

  for (const userId of userIds) {
    const cats = categoryMap[userId];
    const projs = projectMap[userId];

    for (let i = 0; i < 40; i++) {
      const template = expenseTemplates[i % expenseTemplates.length];

      const variation = 1 + (((i * 7 + userId * 3) % 20) - 10) / 100;
      const amount = Math.round(template.amount * variation * 100) / 100;

      const daysAgo = (i * 2 + (userId % 3)) % 90;
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const dateStr = date.toISOString().split('T')[0];

      const categoryId = cats[template.catIdx].id;
      const projectId = projs[i % projs.length];

      await db.query(
        'INSERT INTO expenses (user_id, amount, description, date, category_id, project_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, amount, template.desc, dateStr, categoryId, projectId]
      );
      expenseCount++;
    }
  }

  console.log(`  Created ${expenseCount} expenses`);
  console.log('\nDone! You can log in with:');
  console.log('  Email:    demo@montraq.app');
  console.log('  Password: password123');

  await db.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
