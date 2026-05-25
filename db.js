const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'crm.db');
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON');
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

const allTables = ['accounts','contacts','opportunities','leads','products','purchase_orders','requisitions','vendors','contracts','employees','payroll_runs','benefits','projects','tasks','bugs','team_members','deployments','quotations','invoices','planner_events','departments','categories','sprints','activities','journal_entries','receivables','payables','stock_movements','receiving_records','time_records','repositories','smtp_settings','materials','work_orders','bom','routing','welding_logs','inspection_plans','ndt_records','visual_inspections','hydrostatic_tests','ncr','mtr','calibration_records','equipment','pm_schedules','maintenance_work_orders','maintenance_history','spare_parts'];

async function initSchema() {
  await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      created_by TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS accounts (code TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, subtype TEXT, balance REAL DEFAULT 0, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT, email TEXT, phone TEXT, address TEXT, type TEXT DEFAULT 'Client', status TEXT DEFAULT 'Active', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS opportunities (id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT, contact TEXT, value REAL DEFAULT 0, stage TEXT DEFAULT 'Lead', probability INTEGER DEFAULT 10, source TEXT, expectedClose TEXT, notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT, email TEXT, phone TEXT, source TEXT, status TEXT DEFAULT 'New', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT, category TEXT, supplier TEXT, quantity INTEGER DEFAULT 0, reorderPoint INTEGER DEFAULT 0, unitCost REAL DEFAULT 0, unitPrice REAL DEFAULT 0, location TEXT, status TEXT DEFAULT 'Active', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS purchase_orders (id TEXT PRIMARY KEY, vendor TEXT, date TEXT, status TEXT DEFAULT 'Draft', items TEXT DEFAULT '[]', total REAL DEFAULT 0, notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS requisitions (id TEXT PRIMARY KEY, requester TEXT, department TEXT, date TEXT, items TEXT DEFAULT '[]', status TEXT DEFAULT 'Pending', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS vendors (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT, email TEXT, phone TEXT, status TEXT DEFAULT 'Active', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, vendor TEXT, title TEXT, value REAL DEFAULT 0, startDate TEXT, endDate TEXT, status TEXT DEFAULT 'Active', type TEXT DEFAULT 'Service', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, department TEXT, position TEXT, salary REAL DEFAULT 0, hireDate TEXT, status TEXT DEFAULT 'Active', bankAccount TEXT, taxId TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS payroll_runs (id TEXT PRIMARY KEY, period TEXT, runDate TEXT, totalGross REAL DEFAULT 0, totalDeductions REAL DEFAULT 0, totalNet REAL DEFAULT 0, employees INTEGER DEFAULT 0, status TEXT DEFAULT 'Pending', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS benefits (id TEXT PRIMARY KEY, employee TEXT, type TEXT, provider TEXT, coverage TEXT, monthlyCost REAL DEFAULT 0, status TEXT DEFAULT 'Active', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, lead TEXT, startDate TEXT, endDate TEXT, status TEXT DEFAULT 'Planning', priority TEXT DEFAULT 'Medium', progress INTEGER DEFAULT 0, tasks TEXT DEFAULT '[]', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, project TEXT, title TEXT NOT NULL, assignee TEXT, status TEXT DEFAULT 'To Do', priority TEXT DEFAULT 'Medium', dueDate TEXT, storyPoints INTEGER DEFAULT 0, type TEXT DEFAULT 'Development', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS bugs (id TEXT PRIMARY KEY, project TEXT, title TEXT NOT NULL, severity TEXT DEFAULT 'Minor', status TEXT DEFAULT 'Open', assignee TEXT, reportedBy TEXT, dateReported TEXT, environment TEXT DEFAULT 'Production', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT, avatar TEXT, skills TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS deployments (id TEXT PRIMARY KEY, project TEXT, version TEXT, environment TEXT, status TEXT DEFAULT 'Pending', date TEXT, deployedBy TEXT, duration TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS quotations (id TEXT PRIMARY KEY, customer TEXT NOT NULL, contact TEXT, address TEXT, date TEXT, validUntil TEXT, items TEXT DEFAULT '[]', subtotal REAL DEFAULT 0, tax REAL DEFAULT 0, total REAL DEFAULT 0, notes TEXT, status TEXT DEFAULT 'Draft', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, customer TEXT NOT NULL, contact TEXT, address TEXT, date TEXT, dueDate TEXT, items TEXT DEFAULT '[]', subtotal REAL DEFAULT 0, tax REAL DEFAULT 0, total REAL DEFAULT 0, paidAmount REAL DEFAULT 0, notes TEXT, status TEXT DEFAULT 'Draft', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS planner_events (id TEXT PRIMARY KEY, title TEXT NOT NULL, date TEXT, type TEXT DEFAULT 'event', description TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS sprints (id TEXT PRIMARY KEY, project TEXT, name TEXT, goal TEXT, startDate TEXT, endDate TEXT, status TEXT DEFAULT 'Planning', totalPoints INTEGER DEFAULT 0, completedPoints INTEGER DEFAULT 0, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, type TEXT, subject TEXT, contact TEXT, date TEXT, status TEXT DEFAULT 'Scheduled', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS journal_entries (id TEXT PRIMARY KEY, date TEXT, description TEXT, debitAccount TEXT, creditAccount TEXT, amount REAL DEFAULT 0, status TEXT DEFAULT 'Draft', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS receivables (id TEXT PRIMARY KEY, customer TEXT, amount REAL DEFAULT 0, dueDate TEXT, status TEXT DEFAULT 'Pending', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS payables (id TEXT PRIMARY KEY, vendor TEXT, amount REAL DEFAULT 0, dueDate TEXT, status TEXT DEFAULT 'Pending', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY, product TEXT, type TEXT, quantity INTEGER DEFAULT 0, date TEXT, reference TEXT, notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS receiving_records (id TEXT PRIMARY KEY, po TEXT, item TEXT, qtyOrdered INTEGER DEFAULT 0, qtyReceived INTEGER DEFAULT 0, condition TEXT, receivedBy TEXT, dateReceived TEXT, notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS time_records (id TEXT PRIMARY KEY, employee TEXT, date TEXT, hoursWorked REAL DEFAULT 0, overtime REAL DEFAULT 0, project TEXT, status TEXT DEFAULT 'Pending', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS repositories (id TEXT PRIMARY KEY, name TEXT NOT NULL, language TEXT, branch TEXT DEFAULT 'main', commits INTEGER DEFAULT 0, contributors INTEGER DEFAULT 0, lastCommit TEXT, status TEXT DEFAULT 'Active', created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS smtp_settings (id TEXT PRIMARY KEY, host TEXT NOT NULL, port INTEGER DEFAULT 587, user TEXT, pass TEXT, fromName TEXT, fromEmail TEXT, created_by TEXT DEFAULT '');
    -- NEW: Materials & Stores
    CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, name TEXT NOT NULL, specification TEXT, grade TEXT, form TEXT, dimension TEXT, heatNo TEXT, supplier TEXT, certificateNo TEXT, quantity REAL DEFAULT 0, unit TEXT DEFAULT 'kg', location TEXT, status TEXT DEFAULT 'Active', notes TEXT, created_by TEXT DEFAULT '');
    -- NEW: Fabrication
    CREATE TABLE IF NOT EXISTS work_orders (id TEXT PRIMARY KEY, title TEXT NOT NULL, client TEXT, projectRef TEXT, description TEXT, startDate TEXT, dueDate TEXT, status TEXT DEFAULT 'Planning', priority TEXT DEFAULT 'Medium', progress INTEGER DEFAULT 0, assignedTo TEXT, notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS bom (id TEXT PRIMARY KEY, workOrderId TEXT, materialName TEXT NOT NULL, specification TEXT, grade TEXT, heatNo TEXT, qtyRequired REAL DEFAULT 0, qtyUsed REAL DEFAULT 0, unit TEXT DEFAULT 'kg', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS routing (id TEXT PRIMARY KEY, workOrderId TEXT, operationNo INTEGER DEFAULT 1, operationName TEXT NOT NULL, workCenter TEXT, durationHours REAL DEFAULT 0, assignedTo TEXT, status TEXT DEFAULT 'Pending', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS welding_logs (id TEXT PRIMARY KEY, workOrderId TEXT, weldNo TEXT, jointType TEXT, process TEXT, wpsNo TEXT, welderId TEXT, date TEXT, result TEXT DEFAULT 'Pending', inspector TEXT, notes TEXT, created_by TEXT DEFAULT '');
    -- NEW: Quality Management
    CREATE TABLE IF NOT EXISTS inspection_plans (id TEXT PRIMARY KEY, title TEXT NOT NULL, workOrderId TEXT, client TEXT, date TEXT, status TEXT DEFAULT 'Draft', items TEXT DEFAULT '[]', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS ndt_records (id TEXT PRIMARY KEY, workOrderId TEXT, type TEXT NOT NULL, equipment TEXT, technique TEXT, standard TEXT, result TEXT, operator TEXT, date TEXT, notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS visual_inspections (id TEXT PRIMARY KEY, workOrderId TEXT, item TEXT, standard TEXT, result TEXT, inspector TEXT, date TEXT, defects TEXT, notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS hydrostatic_tests (id TEXT PRIMARY KEY, workOrderId TEXT, equipment TEXT, testPressure REAL DEFAULT 0, holdTime INTEGER DEFAULT 0, medium TEXT DEFAULT 'Water', result TEXT, witness TEXT, date TEXT, certificateNo TEXT, notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS ncr (id TEXT PRIMARY KEY, workOrderId TEXT, description TEXT NOT NULL, severity TEXT DEFAULT 'Minor', disposition TEXT, correctiveAction TEXT, reportedBy TEXT, date TEXT, status TEXT DEFAULT 'Open', closedDate TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS mtr (id TEXT PRIMARY KEY, heatNo TEXT NOT NULL, material TEXT, specification TEXT, grade TEXT, supplier TEXT, certificateNo TEXT, date TEXT, results TEXT DEFAULT '{}', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS calibration_records (id TEXT PRIMARY KEY, equipmentName TEXT NOT NULL, equipmentId TEXT, calibrationDate TEXT, dueDate TEXT, standard TEXT, result TEXT, calibratedBy TEXT, certificateNo TEXT, notes TEXT, created_by TEXT DEFAULT '');
    -- NEW: Maintenance
    CREATE TABLE IF NOT EXISTS equipment (id TEXT PRIMARY KEY, name TEXT NOT NULL, tagNo TEXT, type TEXT, location TEXT, manufacturer TEXT, model TEXT, serialNo TEXT, installDate TEXT, status TEXT DEFAULT 'Active', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS pm_schedules (id TEXT PRIMARY KEY, equipmentId TEXT, taskDescription TEXT NOT NULL, frequencyDays INTEGER DEFAULT 30, lastDone TEXT, nextDue TEXT, assignedTo TEXT, notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS maintenance_work_orders (id TEXT PRIMARY KEY, equipmentId TEXT, type TEXT DEFAULT 'Corrective', description TEXT NOT NULL, priority TEXT DEFAULT 'Medium', assignedTo TEXT, date TEXT, completedDate TEXT, status TEXT DEFAULT 'Open', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS maintenance_history (id TEXT PRIMARY KEY, equipmentId TEXT, workOrderId TEXT, description TEXT, date TEXT, technician TEXT, hoursSpent REAL DEFAULT 0, partsUsed TEXT DEFAULT '[]', notes TEXT, created_by TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS spare_parts (id TEXT PRIMARY KEY, name TEXT NOT NULL, partNo TEXT, equipmentId TEXT, quantity INTEGER DEFAULT 0, minStock INTEGER DEFAULT 0, location TEXT, supplier TEXT, created_by TEXT DEFAULT '');
  `);
  // Existing migration lines for backward compat
  try { db.run("ALTER TABLE vendors ADD COLUMN rating INTEGER DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE vendors ADD COLUMN category TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE vendors ADD COLUMN paymentTerms TEXT DEFAULT 'Net 30'"); } catch(e) {}
  try { db.run("ALTER TABLE projects ADD COLUMN repository TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE tasks ADD COLUMN sprint TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE tasks ADD COLUMN assignee TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE tasks ADD COLUMN storyPoints INTEGER DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE tasks ADD COLUMN type TEXT DEFAULT 'Development'"); } catch(e) {}
  try { db.run("ALTER TABLE bugs ADD COLUMN environment TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE bugs ADD COLUMN dateReported TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE bugs ADD COLUMN assignee TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE deployments ADD COLUMN deployedBy TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE deployments ADD COLUMN duration TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE team_members ADD COLUMN avatar TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE sprints ADD COLUMN goal TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE sprints ADD COLUMN totalPoints INTEGER DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE sprints ADD COLUMN completedPoints INTEGER DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE categories ADD COLUMN description TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE leads ADD COLUMN contact TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE leads ADD COLUMN score INTEGER DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE leads ADD COLUMN value REAL DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE leads ADD COLUMN created TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE opportunities ADD COLUMN closeDate TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE opportunities ADD COLUMN owner TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE purchase_orders ADD COLUMN description TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE purchase_orders ADD COLUMN quantity INTEGER DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE purchase_orders ADD COLUMN unitPrice REAL DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE purchase_orders ADD COLUMN orderDate TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE purchase_orders ADD COLUMN deliveryDate TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE purchase_orders ADD COLUMN approvedBy TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE requisitions ADD COLUMN item TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE requisitions ADD COLUMN quantity INTEGER DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE requisitions ADD COLUMN urgency TEXT DEFAULT 'Medium'"); } catch(e) {}
  try { db.run("ALTER TABLE requisitions ADD COLUMN requestor TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE requisitions ADD COLUMN dateRequested TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE requisitions ADD COLUMN dateApproved TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE journal_entries ADD COLUMN debitAccount TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE journal_entries ADD COLUMN creditAccount TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE receiving_records ADD COLUMN item TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE receiving_records ADD COLUMN qtyOrdered INTEGER DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE receiving_records ADD COLUMN qtyReceived INTEGER DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE receiving_records ADD COLUMN condition TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE receiving_records ADD COLUMN receivedBy TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE receiving_records ADD COLUMN dateReceived TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE employees ADD COLUMN bankAccount TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE employees ADD COLUMN taxId TEXT DEFAULT ''"); } catch(e) {}
  try { db.run("ALTER TABLE projects ADD COLUMN tasks TEXT DEFAULT '[]'"); } catch(e) {}
  allTables.forEach(t => { try { db.run(`ALTER TABLE ${t} ADD COLUMN created_by TEXT DEFAULT ''`); } catch(e) {} });
  saveDb();
}

async function seedData() {
  await getDb();
  const count = queryOne('SELECT COUNT(*) as c FROM users');
  if (count && count.c > 0) return;

  const adminPass = bcrypt.hashSync('admin123', 10);
  const demoPass = bcrypt.hashSync('demo123', 10);
  const staffPass = bcrypt.hashSync('staff123', 10);

  allTables.forEach(t => { try { db.run(`UPDATE ${t} SET created_by = 'U1' WHERE created_by IS NULL OR created_by = ''`); } catch(e) {} });

  const ins = (table, data) => {
    data.created_by = 'U1';
    const keys = Object.keys(data);
    const values = keys.map(k => data[k]);
    const cols = keys.join(',');
    const ph = keys.map(() => '?').join(',');
    runSql(`INSERT INTO ${table} (${cols}) VALUES (${ph})`, values);
  };

  ins('users', { id: 'U1', username: 'admin', password: adminPass, name: 'Admin User', role: 'admin' });
  ins('users', { id: 'U2', username: 'demo', password: demoPass, name: 'Demo User', role: 'staff' });
  ins('users', { id: 'U3', username: 'staff', password: staffPass, name: 'Staff User', role: 'staff' });

  [
    { code: '1001', name: 'Cash', type: 'Asset', subtype: 'Current Asset', balance: 85400 },
    { code: '1002', name: 'Accounts Receivable', type: 'Asset', subtype: 'Current Asset', balance: 32000 },
    { code: '1003', name: 'Inventory', type: 'Asset', subtype: 'Current Asset', balance: 45000 },
    { code: '1004', name: 'Equipment', type: 'Asset', subtype: 'Fixed Asset', balance: 120000 },
    { code: '2001', name: 'Accounts Payable', type: 'Liability', subtype: 'Current Liability', balance: 28000 },
    { code: '2002', name: 'Short-term Loans', type: 'Liability', subtype: 'Current Liability', balance: 15000 },
    { code: '3001', name: 'Common Stock', type: 'Equity', subtype: '', balance: 100000 },
    { code: '3002', name: 'Retained Earnings', type: 'Equity', subtype: '', balance: 85400 },
    { code: '4001', name: 'Product Revenue', type: 'Revenue', subtype: '', balance: 120000 },
  ].forEach(a => ins('accounts', a));

  [
    { id: 'C001', name: 'John Smith', company: 'Acme Corp', email: 'john@acme.com', phone: '+1-555-0101', type: 'Client', status: 'Active', notes: 'Key decision maker' },
    { id: 'C002', name: 'Jane Doe', company: 'Globex Inc', email: 'jane@globex.com', phone: '+1-555-0102', type: 'Client', status: 'Active', notes: 'Prefers email' },
    { id: 'C003', name: 'Bob Johnson', company: 'Wayne Industries', email: 'bob@wayne.com', phone: '+1-555-0103', type: 'Partner', status: 'Active', notes: 'Strategic partner' },
    { id: 'C004', name: 'Alice Williams', company: 'Stark Enterprises', email: 'alice@stark.com', phone: '+1-555-0104', type: 'Client', status: 'Active', notes: 'Enterprise account' },
    { id: 'C005', name: 'Charlie Brown', company: 'Brown LLC', email: 'charlie@brown.com', phone: '+1-555-0105', type: 'Lead', status: 'Inactive', notes: 'Follow up in Q3' },
  ].forEach(c => ins('contacts', c));

  [
    { id: 'OPP001', name: 'Enterprise License Deal', company: 'Acme Corp', contact: 'John Smith', value: 50000, stage: 'Negotiation', probability: 60, source: 'Referral', expectedClose: '2026-06-15', notes: '' },
    { id: 'OPP002', name: 'Consulting Project', company: 'Globex Inc', contact: 'Jane Doe', value: 25000, stage: 'Proposal', probability: 40, source: 'Website', expectedClose: '2026-07-01', notes: '' },
    { id: 'OPP003', name: 'Hardware Supply Contract', company: 'Wayne Industries', contact: 'Bob Johnson', value: 75000, stage: 'Closed Won', probability: 100, source: 'Partner', expectedClose: '2026-05-01', notes: 'Signed' },
    { id: 'OPP004', name: 'Maintenance Package', company: 'Stark Enterprises', contact: 'Alice Williams', value: 15000, stage: 'Discovery', probability: 20, source: 'Email Campaign', expectedClose: '2026-08-01', notes: '' },
    { id: 'OPP005', name: 'IoT Solution', company: 'Brown LLC', contact: 'Charlie Brown', value: 35000, stage: 'Lead', probability: 10, source: 'Trade Show', expectedClose: '2026-09-01', notes: '' },
  ].forEach(o => ins('opportunities', o));

  [
    { id: 'PRD001', name: 'Microcontroller X100', sku: 'MC-X100', category: 'CAT001', supplier: 'SUP001', quantity: 250, reorderPoint: 50, unitCost: 12.50, unitPrice: 25.00, location: 'A-01', status: 'Active' },
    { id: 'PRD002', name: 'Servo Motor S200', sku: 'SM-S200', category: 'CAT002', supplier: 'SUP001', quantity: 80, reorderPoint: 20, unitCost: 85.00, unitPrice: 180.00, location: 'B-03', status: 'Active' },
    { id: 'PRD003', name: 'Sensor Pack P5', sku: 'SP-P5', category: 'CAT001', supplier: 'SUP002', quantity: 500, reorderPoint: 100, unitCost: 4.50, unitPrice: 8.50, location: 'A-05', status: 'Active' },
    { id: 'PRD004', name: 'Industrial Robot Arm', sku: 'IR-2000', category: 'CAT002', supplier: 'SUP003', quantity: 15, reorderPoint: 5, unitCost: 2500.00, unitPrice: 5500.00, location: 'C-01', status: 'Active' },
    { id: 'PRD005', name: 'Software License Pro', sku: 'SW-PRO', category: 'CAT003', supplier: 'SUP002', quantity: 999, reorderPoint: 50, unitCost: 50.00, unitPrice: 150.00, location: 'Virtual', status: 'Active' },
    { id: 'PRD006', name: 'Cooling Fan CF50', sku: 'CF-50', category: 'CAT001', supplier: 'SUP003', quantity: 5, reorderPoint: 30, unitCost: 8.00, unitPrice: 18.00, location: 'A-02', status: 'Active' },
  ].forEach(p => ins('products', p));

  ['TechSupply Co', 'Global Parts Inc', 'Industrial Direct'].forEach((n, i) => ins('vendors', { id: `SUP00${i+1}`, name: n, contact: `Contact ${i+1}`, email: `vendor${i+1}@test.com`, phone: '+1-555-030' + (i+1), status: 'Active' }));

  [
    { id: 'PO-001', vendor: 'TechSupply Co', date: '2026-04-01', status: 'Received', items: JSON.stringify([{ product: 'Microcontroller X100', qty: 100, unitPrice: 12.00, total: 1200 }]), total: 1200, notes: '' },
    { id: 'PO-002', vendor: 'Global Parts Inc', date: '2026-04-15', status: 'Shipped', items: JSON.stringify([{ product: 'Sensor Pack P5', qty: 200, unitPrice: 4.00, total: 800 }]), total: 800, notes: 'Rush' },
    { id: 'PO-003', vendor: 'Industrial Direct', date: '2026-05-01', status: 'Pending', items: JSON.stringify([{ product: 'Industrial Robot Arm', qty: 2, unitPrice: 2400, total: 4800 }]), total: 4800, notes: '' },
  ].forEach(p => ins('purchase_orders', p));

  [
    { id: 'EMP001', name: 'Alice Williams', email: 'alice@company.com', department: 'Engineering', position: 'Lead Engineer', salary: 95000, hireDate: '2020-03-15', status: 'Active', bankAccount: '****1234', taxId: '123-45-6789' },
    { id: 'EMP002', name: 'Bob Johnson', email: 'bob@company.com', department: 'Operations', position: 'Ops Manager', salary: 85000, hireDate: '2019-07-01', status: 'Active', bankAccount: '****5678', taxId: '987-65-4321' },
    { id: 'EMP003', name: 'Carol Martinez', email: 'carol@company.com', department: 'Marketing', position: 'Marketing Director', salary: 90000, hireDate: '2021-01-10', status: 'On Leave', bankAccount: '****9012', taxId: '456-78-9012' },
    { id: 'EMP004', name: 'David Lee', email: 'david@company.com', department: 'Engineering', position: 'Developer', salary: 75000, hireDate: '2022-06-01', status: 'Active', bankAccount: '****3456', taxId: '789-01-2345' },
    { id: 'EMP005', name: 'Eva Chen', email: 'eva@company.com', department: 'Finance', position: 'Analyst', salary: 70000, hireDate: '2023-02-15', status: 'Active', bankAccount: '****7890', taxId: '234-56-7890' },
  ].forEach(e => ins('employees', e));

  [
    { id: 'PRJ001', name: 'Smart Dashboard v2', description: 'Analytics platform', lead: 'Alice Williams', startDate: '2026-01-15', endDate: '2026-06-30', status: 'In Progress', priority: 'High', progress: 65, tasks: '[]' },
    { id: 'PRJ002', name: 'Mobile App', description: 'Customer mobile app', lead: 'David Lee', startDate: '2026-03-01', endDate: '2026-08-31', status: 'In Progress', priority: 'High', progress: 40, tasks: '[]' },
    { id: 'PRJ003', name: 'Legacy Migration', description: 'Cloud migration', lead: 'Alice Williams', startDate: '2026-02-01', endDate: '2026-05-15', status: 'In Progress', priority: 'Medium', progress: 80, tasks: '[]' },
    { id: 'PRJ004', name: 'Security Audit', description: 'Compliance audit', lead: 'Alice Williams', startDate: '2026-05-01', endDate: '2026-06-15', status: 'Planning', priority: 'High', progress: 10, tasks: '[]' },
  ].forEach(p => ins('projects', p));

  [
    { id: 'QOT-001', customer: 'Acme Corp', contact: 'John Smith', address: 'No 12, Road 2, 45700 Subang Jaya, Selangor', date: '2026-05-01', validUntil: '2026-06-01', items: JSON.stringify([{ product: 'Microcontroller X100', sku: 'MC-X100', qty: 10, unitPrice: 25.00, total: 250.00 }]), subtotal: 250.00, tax: 25.00, total: 275.00, notes: 'Initial quote', status: 'Sent' },
    { id: 'QOT-002', customer: 'Globex Inc', contact: 'Jane Doe', address: 'Lot 7, Jalan Teknologi, 57000 KL', date: '2026-05-05', validUntil: '2026-06-05', items: JSON.stringify([{ product: 'Servo Motor S200', sku: 'SM-S200', qty: 5, unitPrice: 180.00, total: 900.00 }, { product: 'Sensor Pack P5', sku: 'SP-P5', qty: 20, unitPrice: 8.50, total: 170.00 }]), subtotal: 1070.00, tax: 107.00, total: 1177.00, notes: '', status: 'Draft' },
    { id: 'QOT-003', customer: 'Wayne Industries', contact: 'Bruce Wayne', address: '88 Business Park, 50400 KL', date: '2026-05-10', validUntil: '2026-06-10', items: JSON.stringify([{ product: 'Microcontroller X100', sku: 'MC-X100', qty: 50, unitPrice: 22.00, total: 1100.00 }]), subtotal: 1100.00, tax: 110.00, total: 1210.00, notes: 'Bulk discount', status: 'Accepted' },
  ].forEach(q => ins('quotations', q));

  [
    { id: 'INV-001', customer: 'Acme Corp', contact: 'John Smith', address: 'No 12, Road 2, 45700 Subang Jaya, Selangor', date: '2026-05-02', dueDate: '2026-06-01', items: JSON.stringify([{ product: 'Microcontroller X100', sku: 'MC-X100', qty: 10, unitPrice: 25.00, total: 250.00 }]), subtotal: 250.00, tax: 25.00, total: 275.00, paidAmount: 275.00, notes: '', status: 'Paid' },
    { id: 'INV-002', customer: 'Stark Enterprises', contact: 'Tony Stark', address: 'Level 15, Tower B, 59200 KL', date: '2026-05-08', dueDate: '2026-06-07', items: JSON.stringify([{ product: 'Servo Motor S200', sku: 'SM-S200', qty: 3, unitPrice: 180.00, total: 540.00 }]), subtotal: 540.00, tax: 54.00, total: 594.00, paidAmount: 0, notes: 'Net 30', status: 'Sent' },
    { id: 'INV-003', customer: 'Globex Inc', contact: 'Jane Doe', address: 'Lot 7, Jalan Teknologi, 57000 KL', date: '2026-04-15', dueDate: '2026-05-15', items: JSON.stringify([{ product: 'Sensor Pack P5', sku: 'SP-P5', qty: 100, unitPrice: 8.50, total: 850.00 }]), subtotal: 850.00, tax: 85.00, total: 935.00, paidAmount: 0, notes: '', status: 'Overdue' },
  ].forEach(i => ins('invoices', i));

  // Seed materials
  [
    { id: 'MAT001', name: 'Carbon Steel Plate', specification: 'ASTM A36', grade: 'Gr 36', form: 'Plate', dimension: '12mm x 2400 x 1200mm', heatNo: 'HT-22001', supplier: 'TechSupply Co', certificateNo: 'MTR-22001', quantity: 5000, unit: 'kg', location: 'Yard A-1', status: 'Active', notes: '' },
    { id: 'MAT002', name: 'Stainless Steel Pipe', specification: 'ASTM A312 TP304', grade: '304', form: 'Pipe', dimension: '6" SCH 40', heatNo: 'HT-22005', supplier: 'Global Parts Inc', certificateNo: 'MTR-22005', quantity: 1200, unit: 'kg', location: 'Yard B-2', status: 'Active', notes: 'Seamless' },
    { id: 'MAT003', name: 'Carbon Steel Flange', specification: 'ASTM A105', grade: 'Gr 105', form: 'Flange', dimension: '8" 150# RF', heatNo: 'HT-22010', supplier: 'Industrial Direct', certificateNo: 'MTR-22010', quantity: 45, unit: 'pcs', location: 'Rack C-1', status: 'Active', notes: '' },
    { id: 'MAT004', name: 'Welding Electrode', specification: 'AWS E7018', grade: 'E7018', form: 'Rod', dimension: '3.2mm x 350mm', heatNo: 'EL-23001', supplier: 'TechSupply Co', certificateNo: 'COA-23001', quantity: 200, unit: 'kg', location: 'Store D-1', status: 'Active', notes: 'Low hydrogen' },
  ].forEach(m => ins('materials', m));

  // Seed work orders
  [
    { id: 'WO001', title: 'Skid Fabrication - Project Alpha', client: 'Acme Corp', projectRef: 'PA-2026-001', description: 'Fabrication of process skid including piping, supports and valves', startDate: '2026-05-01', dueDate: '2026-06-30', status: 'In Progress', priority: 'High', progress: 35, assignedTo: 'Alice Williams', notes: '' },
    { id: 'WO002', title: 'Pressure Vessel Repair', client: 'Stark Enterprises', projectRef: 'SE-2026-002', description: 'Repair of 10m3 pressure vessel including hydrostatic test', startDate: '2026-05-15', dueDate: '2026-06-15', status: 'Planning', priority: 'High', progress: 10, assignedTo: 'David Lee', notes: 'Requires NDT' },
    { id: 'WO003', title: 'Pipe Spool Fabrication', client: 'Globex Inc', projectRef: 'GI-2026-003', description: 'Pre-fabrication of pipe spools for cooling water system', startDate: '2026-06-01', dueDate: '2026-07-15', status: 'Planning', priority: 'Medium', progress: 0, assignedTo: 'Alice Williams', notes: '' },
  ].forEach(w => ins('work_orders', w));

  // Seed BOM
  [
    { id: 'BOM001', workOrderId: 'WO001', materialName: 'Carbon Steel Plate', specification: 'ASTM A36', grade: 'Gr 36', heatNo: 'HT-22001', qtyRequired: 800, qtyUsed: 0, unit: 'kg', notes: 'Base frame' },
    { id: 'BOM002', workOrderId: 'WO001', materialName: 'Stainless Steel Pipe', specification: 'ASTM A312 TP304', grade: '304', heatNo: 'HT-22005', qtyRequired: 150, qtyUsed: 0, unit: 'kg', notes: 'Process piping' },
    { id: 'BOM003', workOrderId: 'WO001', materialName: 'Welding Electrode', specification: 'AWS E7018', grade: 'E7018', heatNo: 'EL-23001', qtyRequired: 15, qtyUsed: 0, unit: 'kg', notes: 'SMAW welding' },
    { id: 'BOM004', workOrderId: 'WO002', materialName: 'Carbon Steel Flange', specification: 'ASTM A105', grade: 'Gr 105', heatNo: 'HT-22010', qtyRequired: 4, qtyUsed: 0, unit: 'pcs', notes: 'Replacement flanges' },
  ].forEach(b => ins('bom', b));

  // Seed routing
  [
    { id: 'RTG001', workOrderId: 'WO001', operationNo: 1, operationName: 'Material Cutting', workCenter: 'Cutting Bay', durationHours: 8, assignedTo: 'Bob Johnson', status: 'In Progress', notes: '' },
    { id: 'RTG002', workOrderId: 'WO001', operationNo: 2, operationName: 'Fitting & Tack Weld', workCenter: 'Fitting Bay', durationHours: 16, assignedTo: '', status: 'Pending', notes: '' },
    { id: 'RTG003', workOrderId: 'WO001', operationNo: 3, operationName: 'Welding', workCenter: 'Welding Bay', durationHours: 24, assignedTo: '', status: 'Pending', notes: 'WPS P1' },
    { id: 'RTG004', workOrderId: 'WO001', operationNo: 4, operationName: 'NDT Inspection', workCenter: 'Inspection', durationHours: 4, assignedTo: '', status: 'Pending', notes: 'RT + UT' },
    { id: 'RTG005', workOrderId: 'WO001', operationNo: 5, operationName: 'Hydrostatic Test', workCenter: 'Test Bay', durationHours: 6, assignedTo: '', status: 'Pending', notes: 'Test pressure 10 bar' },
  ].forEach(r => ins('routing', r));

  // Seed NDT records
  [
    { id: 'NDT001', workOrderId: 'WO001', type: 'RT', equipment: 'XR-2000', technique: 'Single Wall', standard: 'ASME V', result: 'Pending', operator: 'NDT Tech A', date: '2026-05-20', notes: 'Weld NDT 1-4' },
    { id: 'NDT002', workOrderId: 'WO001', type: 'UT', equipment: 'USM-100', technique: 'Contact', standard: 'ASME V', result: 'Pending', operator: 'NDT Tech A', date: '2026-05-20', notes: 'Butt welds' },
  ].forEach(n => ins('ndt_records', n));

  // Seed equipment
  [
    { id: 'EQ001', name: 'Overhead Crane 10T', tagNo: 'CR-001', type: 'Crane', location: 'Main Workshop', manufacturer: 'Konecranes', model: 'CXT-10', serialNo: 'KN-22001', installDate: '2022-03-15', status: 'Active', notes: '' },
    { id: 'EQ002', name: 'Welding Machine 500A', tagNo: 'WM-002', type: 'Welding', location: 'Welding Bay', manufacturer: 'Lincoln Electric', model: 'Flextec 500', serialNo: 'LE-23001', installDate: '2023-01-10', status: 'Active', notes: '' },
    { id: 'EQ003', name: 'Air Compressor 100PSI', tagNo: 'AC-003', type: 'Compressor', location: 'Utility Room', manufacturer: 'Atlas Copco', model: 'GA-37', serialNo: 'AC-21005', installDate: '2021-06-01', status: 'Active', notes: '' },
    { id: 'EQ004', name: 'Hydrostatic Test Pump', tagNo: 'HP-004', type: 'Test Equipment', location: 'Test Bay', manufacturer: 'Ralston', model: 'HTP-150', serialNo: 'RL-24001', installDate: '2024-02-01', status: 'Active', notes: 'Max 150 bar' },
  ].forEach(e => ins('equipment', e));

  // Seed PM schedules
  [
    { id: 'PM001', equipmentId: 'EQ001', taskDescription: 'Lubrication and wire rope inspection', frequencyDays: 30, lastDone: '2026-04-20', nextDue: '2026-05-20', assignedTo: 'Maintenance Team', notes: '' },
    { id: 'PM002', equipmentId: 'EQ002', taskDescription: 'Check cables, torch, gas connections', frequencyDays: 15, lastDone: '2026-05-05', nextDue: '2026-05-20', assignedTo: 'Maintenance Team', notes: '' },
  ].forEach(p => ins('pm_schedules', p));

  saveDb();
}

module.exports = { getDb, initSchema, seedData, queryAll, queryOne, runSql };
