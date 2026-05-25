# AD-Deen Engineering ERP Suite

A single-page ERP system for fabrication, maintenance, quality management, and materials control — with 11 integrated modules backed by SQLite + RESTful Node.js API.

## Features

- **Dashboard** — Real-time KPI cards across all modules
- **CRM & Sales** — Contacts, leads, opportunities, pipeline, activities
- **Materials & Stores** — Material master with spec/grade/heat/cert tracking, stock movements, warehouse store overview, analytics
- **Fabrication** — Work orders, Bill of Materials (BOM), operation routing, welding logs
- **Quality Management** — Inspection plans, NDT (UT/RT/MT/PT), visual inspections, hydrostatic testing, NCR, MTR, calibration records
- **Maintenance** — Equipment registry, PM schedules, maintenance work orders, service history, spare parts
- **Procurement** — Vendors, purchase orders, requisitions, receiving records, contracts
- **Accounting** — Chart of accounts, journal entries, receivables, payables, trial balance, reports
- **Payroll** — Employees, payroll runs, benefits, time records
- **Planner** — Monthly calendar with events, project milestone overlay
- **Invoicing** — Quotations (with email sending) and invoices with PDF printing
- **Smart Customer Pick** — Select CRM contacts in Quotations/Invoices; auto-fills company name and address
- **Flexible Item Entry** — Toggle between inventory products and free-text items in Quotations/Invoices
- **Mobile Responsive** — Hamburger menu, stacked layouts, resized tables/buttons for phones (≤600px)
- **Multi-User** — Role-based access (admin/staff), per-user data isolation
- **Dark Mode** — Toggle in the top bar, persists via localStorage
- **Online Presence** — Live user count shown in sidebar
- **Print to PDF** — All report and detail views

## Quick Start

```bash
cd backend
npm install
node server.js        # or: node start.js (detached)
```

Open **http://localhost:3001** in your browser.

## Login Credentials

| Username | Password | Role  |
|----------|----------|-------|
| admin    | admin123 | Admin |
| demo     | demo123  | Staff |
| staff    | staff123 | Staff |

- **Admin** — full access to all 11 modules
- **Staff** — restricted to Dashboard, Materials, Fabrication, Quality, Maintenance, Planner, Invoicing

## Project Structure

```
CRM/
├── index_CRM.html          # Single-page application (all CSS + JS)
├── backend/
│   ├── server.js           # Express API server (port 3001)
│   ├── db.js               # SQLite schema (50 tables), migrations, seed
│   ├── start.js            # Detached process launcher
│   ├── package.json
│   └── crm.db              # SQLite database (auto-created on first run)
└── README.md
```

## Architecture

### Frontend
All-in-one HTML file. Each module is an IIFE that exports a `render()` function to `window`. The app controller (`moduleMap`) routes nav clicks to the appropriate module renderer.

Sidebar order: Dashboard → CRM → Materials → Fabrication → Quality → Maintenance → Procurement → Accounting → Payroll → Planner → Invoicing

### Backend
Express server on port 3001. Generic CRUD routes for 50 tables via `tables.forEach()` pattern. Auth via JWT with per-user `created_by` filtering for data isolation.

### Data Isolation
Every table has a `created_by TEXT` column. All queries filter by `req.userId` extracted from the JWT. Each user has their own workspace.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/login` | No | Returns JWT + user info |
| GET/POST/PUT/DELETE | `/api/:table` | Yes | Generic CRUD (50 tables) |
| POST | `/api/heartbeat` | Yes | Keep online session alive |
| GET | `/api/online-users` | Yes | List currently active users |
| GET | `/api/dashboard` | Yes | Aggregated KPI data across all modules |
| POST | `/api/send-quotation/:id` | Yes | Email a quotation via SMTP |

## Database Tables (50)

**Core:** users, accounts, contacts, opportunities, leads, products, purchase_orders, requisitions, vendors, contracts, employees, payroll_runs, benefits, projects, tasks, bugs, team_members, deployments, quotations, invoices, planner_events, departments, categories, sprints, activities, journal_entries, receivables, payables, stock_movements, receiving_records, time_records, repositories, smtp_settings

**Materials:** materials (spec, grade, heatNo, certificateNo, supplier)

**Fabrication:** work_orders, bom (Bill of Materials), routing (operations), welding_logs

**Quality:** inspection_plans, ndt_records (UT/RT/MT/PT), visual_inspections, hydrostatic_tests, ncr (non-conformance reports), mtr (material test reports), calibration_records

**Maintenance:** equipment, pm_schedules, maintenance_work_orders, maintenance_history, spare_parts

## Email Configuration

1. Click the **gear icon** (⚙) in the sidebar footer
2. Add one or more SMTP configurations (name, email, host, port, password)
3. From any quotation, click the **envelope icon** (✉) to send
4. Select which sender profile to use from the dropdown

For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) on port 587.

## Dark Mode

Click the **moon/sun icon** in the top bar. Preference is saved in localStorage and restored on page reload.

## Permissions

- **Staff** users see: Dashboard, Materials, Fabrication, Quality, Maintenance, Planner, Invoicing
- **Admin** users see all 11 modules
- Role is assigned per user in the database (`users.role` column)

## Technology Stack

- **Frontend**: Vanilla JS, CSS custom properties, Font Awesome 6
- **Backend**: Express 4, sql.js, bcryptjs, jsonwebtoken, nodemailer
- **Database**: SQLite (via sql.js WASM)
- **Font**: Inter (Google Fonts)
