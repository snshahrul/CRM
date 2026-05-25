const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { getDb, initSchema, seedData, queryAll, queryOne, runSql } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'crm-jwt-secret-2026';

// Online session tracking
const onlineSessions = new Map();
const ONLINE_TIMEOUT = 120000; // 2 minutes

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of onlineSessions) {
    if (now - s.lastSeen > ONLINE_TIMEOUT) onlineSessions.delete(id);
  }
}, 60000);

const app = express();
const PORT = parseInt(process.env.PORT) || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'crm.db');

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(req.method, req.path, JSON.stringify(req.body).slice(0,200));
  next();
});

async function init() {
  await initSchema();
  await seedData();
  console.log('Database ready.');
}
init();

// Auth middleware
function auth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userName = decoded.name;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Required' });
  await getDb();
  const user = queryOne('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id, name: user.name, username: user.username, role: user.role }, JWT_SECRET);
  onlineSessions.set(user.id, { userId: user.id, name: user.name, username: user.username, role: user.role, lastSeen: Date.now() });
  res.json({ token, name: user.name, id: user.id, username: user.username, role: user.role });
});

// Heartbeat — keeps session alive
app.post('/api/heartbeat', auth, (req, res) => {
  onlineSessions.set(req.userId, { userId: req.userId, name: req.userName, lastSeen: Date.now() });
  res.json({ ok: true });
});

// Online users
app.get('/api/online-users', auth, (req, res) => {
  const now = Date.now();
  const online = [];
  for (const s of onlineSessions.values()) {
    if (now - s.lastSeen < ONLINE_TIMEOUT) online.push({ id: s.userId, name: s.name });
  }
  res.json(online);
});

// Send email
app.post('/api/send-email', auth, async (req, res) => {
  try {
    const settings = queryOne('SELECT * FROM smtp_settings WHERE created_by = ?', [req.userId]);
    if (!settings) return res.status(400).json({ error: 'No SMTP settings configured' });
    const transporter = nodemailer.createTransport({
      host: settings.host, port: settings.port,
      secure: settings.port === 465,
      auth: { user: settings.user, pass: settings.pass }
    });
    await transporter.sendMail({
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: req.body.to,
      subject: req.body.subject,
      html: req.body.html
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Send quotation as email
app.post('/api/send-quotation/:id', auth, async (req, res) => {
  try {
    const q = queryOne('SELECT * FROM quotations WHERE id = ? AND created_by = ?', [req.params.id, req.userId]);
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    let settings;
    if (req.body.configId) {
      settings = queryOne('SELECT * FROM smtp_settings WHERE id = ? AND created_by = ?', [req.body.configId, req.userId]);
    } else {
      settings = queryOne('SELECT * FROM smtp_settings WHERE created_by = ?', [req.userId]);
    }
    if (!settings) return res.status(400).json({ error: 'No SMTP settings configured' });
    const items = JSON.parse(q.items || '[]');
    let itemsHtml = items.map(i => `<tr><td>${i.product || i.item || ''}</td><td>${i.qty || 0}</td><td>$${(i.unitPrice || 0).toFixed(2)}</td><td>$${(i.total || 0).toFixed(2)}</td></tr>`).join('');
    const html = `<h2>Quotation ${q.id}</h2><p><strong>Customer:</strong> ${q.customer}</p><p><strong>Date:</strong> ${q.date}</p><p><strong>Valid Until:</strong> ${q.validUntil}</p><table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%"><tr style="background:#f0f4f9"><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>${itemsHtml}<tr><td colspan="3" style="text-align:right"><strong>Subtotal</strong></td><td>$${(q.subtotal||0).toFixed(2)}</td></tr><tr><td colspan="3" style="text-align:right"><strong>Tax</strong></td><td>$${(q.tax||0).toFixed(2)}</td></tr><tr><td colspan="3" style="text-align:right"><strong>Total</strong></td><td>$${(q.total||0).toFixed(2)}</td></tr></table><p>${q.notes || ''}</p>`;
    const transporter = nodemailer.createTransport({
      host: settings.host, port: settings.port,
      secure: settings.port === 465,
      auth: { user: settings.user, pass: settings.pass }
    });
    await transporter.sendMail({
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: req.body.to || q.contact,
      subject: `Quotation ${q.id} from ${settings.fromName}`,
      html
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generic CRUD
app.get('/api/departments', auth, (req, res) => res.json(queryAll('SELECT * FROM departments')));
app.get('/api/categories', auth, (req, res) => res.json(queryAll('SELECT * FROM categories')));

const tables = [
  'accounts', 'contacts', 'opportunities', 'leads',
  'products', 'purchase_orders', 'requisitions', 'vendors', 'contracts',
  'employees', 'payroll_runs', 'benefits',
  'projects', 'tasks', 'bugs', 'team_members', 'deployments', 'sprints',
  'quotations', 'invoices', 'planner_events',
  'activities', 'journal_entries', 'receivables', 'payables',
  'stock_movements', 'receiving_records', 'time_records', 'repositories',
  'smtp_settings',
  'materials', 'work_orders', 'bom', 'routing', 'welding_logs',
  'inspection_plans', 'ndt_records', 'visual_inspections', 'hydrostatic_tests', 'ncr', 'mtr', 'calibration_records',
  'equipment', 'pm_schedules', 'maintenance_work_orders', 'maintenance_history', 'spare_parts'
];

tables.forEach(table => {
  app.get(`/api/${table}`, auth, (req, res) => {
    res.json(queryAll(`SELECT * FROM ${table} WHERE created_by = ?`, [req.userId]));
  });
  app.get(`/api/${table}/:id`, auth, (req, res) => {
    const row = queryOne(`SELECT * FROM ${table} WHERE id = ? AND created_by = ?`, [req.params.id, req.userId]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
  app.post(`/api/${table}`, auth, (req, res) => {
    const data = Object.assign({}, req.body, { created_by: req.userId });
    const keys = Object.keys(data);
    const values = keys.map(k => data[k]);
    const cols = keys.join(',');
    const ph = keys.map(() => '?').join(',');
    runSql(`INSERT INTO ${table} (${cols}) VALUES (${ph})`, values);
    res.json({ success: true });
  });
  app.put(`/api/${table}/:id`, auth, (req, res) => {
    const existing = queryOne(`SELECT id FROM ${table} WHERE id = ? AND created_by = ?`, [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = req.body;
    const keys = Object.keys(data);
    const set = keys.map(k => `${k} = ?`).join(',');
    const values = keys.map(k => data[k]);
    values.push(req.params.id);
    runSql(`UPDATE ${table} SET ${set} WHERE id = ?`, values);
    res.json({ success: true });
  });
  app.delete(`/api/${table}/:id`, auth, (req, res) => {
    const existing = queryOne(`SELECT id FROM ${table} WHERE id = ? AND created_by = ?`, [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    runSql(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  });
});

// Dashboard
app.get('/api/dashboard', auth, async (req, res) => {
  await getDb();
  const uid = req.userId;
  const revenue = queryOne(`SELECT COALESCE(SUM(balance),0) as v FROM accounts WHERE type = 'Revenue' AND created_by = ?`, [uid]).v;
  const assets = queryOne(`SELECT COALESCE(SUM(balance),0) as v FROM accounts WHERE type = 'Asset' AND created_by = ?`, [uid]).v;
  const activeContacts = queryOne(`SELECT COUNT(*) as c FROM contacts WHERE status = 'Active' AND created_by = ?`, [uid]).c;
  const pipeline = queryOne(`SELECT COALESCE(SUM(value),0) as v FROM opportunities WHERE stage NOT IN ('Closed Won','Closed Lost') AND created_by = ?`, [uid]).v;
  const prodCount = queryOne(`SELECT COUNT(*) as c FROM products WHERE created_by = ?`, [uid]).c;
  const stockVal = queryOne(`SELECT COALESCE(SUM(quantity * unitCost),0) as v FROM products WHERE created_by = ?`, [uid]).v;
  const pendPOs = queryOne(`SELECT COUNT(*) as c FROM purchase_orders WHERE status IN ('Pending','Draft') AND created_by = ?`, [uid]).c;
  const contractVal = queryOne(`SELECT COALESCE(SUM(value),0) as v FROM contracts WHERE status = 'Active' AND created_by = ?`, [uid]).v;
  const empCount = queryOne(`SELECT COUNT(*) as c FROM employees WHERE created_by = ?`, [uid]).c;
  const monthPay = queryOne(`SELECT COALESCE(SUM(salary),0)/12 as v FROM employees WHERE created_by = ?`, [uid]).v;
  const activeProjs = queryOne(`SELECT COUNT(*) as c FROM projects WHERE status != 'Completed' AND created_by = ?`, [uid]).c;
  const openBugs = queryOne(`SELECT COUNT(*) as c FROM bugs WHERE status NOT IN ('Resolved','Closed') AND created_by = ?`, [uid]).c;
  const invQots = queryOne(`SELECT COUNT(*) as c FROM quotations WHERE created_by = ?`, [uid]).c;
  const invInvs = queryOne(`SELECT COUNT(*) as c FROM invoices WHERE created_by = ?`, [uid]).c;
  const matCount = queryOne(`SELECT COUNT(*) as c FROM materials WHERE created_by = ?`, [uid]).c;
  const activeWOs = queryOne(`SELECT COUNT(*) as c FROM work_orders WHERE status NOT IN ('Completed','Cancelled') AND created_by = ?`, [uid]).c;
  const openNCRs = queryOne(`SELECT COUNT(*) as c FROM ncr WHERE status NOT IN ('Closed','Resolved') AND created_by = ?`, [uid]).c;
  const pendingInsp = queryOne(`SELECT COUNT(*) as c FROM ndt_records WHERE result = 'Pending' AND created_by = ?`, [uid]).c;
  const equipCount = queryOne(`SELECT COUNT(*) as c FROM equipment WHERE created_by = ?`, [uid]).c;
  const openMWOs = queryOne(`SELECT COUNT(*) as c FROM maintenance_work_orders WHERE status = 'Open' AND created_by = ?`, [uid]).c;

  res.json({
    accounting: { revenue, assets },
    crm: { activeContacts, pipeline },
    inventory: { prodCount, stockVal },
    procurement: { pendPOs, contractVal },
    payroll: { empCount, monthPay },
    engineering: null,
    invoicing: { invQots, invInvs },
    materials: { matCount },
    fabrication: { activeWOs },
    quality: { openNCRs, pendingInsp },
    maintenance: { equipCount, openMWOs }
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index_CRM.html'));
});

app.listen(PORT, () => {
  console.log(`CRM Backend running on http://localhost:${PORT}`);
});
