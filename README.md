# BOTFORCE Unity

A production-ready invoicing, time tracking, expense management, and accounting-prep tool for BOTFORCE GmbH (Austria, Vienna).

> **Note**: This is NOT a full accounting system. It's an invoicing + time tracking + expenses + accounting-prep export tool designed to prepare monthly packages for handoff to an external accountant.

## Features

### Core Functionality

| Feature | Status | Description |
|---------|--------|-------------|
| **Multi-Role Access** | ✅ Complete | Superadmin, Employee, Accountant with strict RLS |
| **Project Management** | ✅ Complete | Projects under customers with employee assignments |
| **Time Tracking** | ✅ Complete | Full workflow: draft → submitted → approved → invoiced |
| **Austrian Invoicing** | ✅ Complete | Sequential numbers, immutable after issue, PDF generation |
| **Expense Management** | ✅ Complete | Receipt upload, approval workflow, mileage/travel time |
| **Accounting Export** | ✅ Complete | CSV + PDF ZIP packages for accountant handoff |
| **Reverse Charge (EU B2B)** | ✅ Complete | Auto-detect for EU customers, PDF notice |
| **Email Integration** | ✅ Complete | Invoice sending, payment reminders |

### User Roles

| Role | Capabilities |
|------|-------------|
| **SUPERADMIN** | Full access: all projects, time entries, expenses, documents, team management |
| **EMPLOYEE** | View assigned projects only, manage own time entries (draft/submitted), own expenses |
| **ACCOUNTANT** | Read-only on documents/expenses, create accounting exports, no deletions |

### Time Entry Workflow

```
┌─────────┐     ┌───────────┐     ┌──────────┐     ┌──────────┐
│  DRAFT  │ ──► │ SUBMITTED │ ──► │ APPROVED │ ──► │ INVOICED │
└─────────┘     └───────────┘     └──────────┘     └──────────┘
                      │                 │
                      ▼                 ▼
                ┌──────────┐      ┌──────────┐
                │ REJECTED │ ◄─── │ REJECTED │
                └──────────┘      └──────────┘
```

- **Employees**: Can move draft → submitted
- **Superadmins**: Can approve/reject (with reason), bulk operations supported
- **Invoiced**: Immutable, locked with rate snapshot

### Document Workflow

```
┌─────────┐     ┌────────┐     ┌──────┐
│  DRAFT  │ ──► │ ISSUED │ ──► │ PAID │
└─────────┘     └────────┘     └──────┘
                     │
                     ▼
               ┌───────────┐
               │ CANCELLED │
               └───────────┘
```

- **Draft**: Editable, no document number
- **Issued**: Locked, sequential number assigned, customer/company snapshots stored
- **Paid**: Payment date recorded
- **Cancelled**: Voided (typically with credit note)

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (Postgres, Auth, Storage, RLS, Edge Functions)
- **PDF Generation**: jsPDF with jspdf-autotable
- **Email**: Resend
- **Deployment**: Vercel (frontend) + Supabase Cloud (backend)
- **Testing**: Vitest + Playwright

## Project Structure

```
botforce-unity/
├── apps/
│   └── web/                      # Next.js application
│       ├── src/
│       │   ├── app/              # App Router pages
│       │   │   ├── (authenticated)/  # Protected routes
│       │   │   │   ├── dashboard/
│       │   │   │   ├── customers/
│       │   │   │   ├── projects/
│       │   │   │   ├── timesheets/
│       │   │   │   ├── documents/
│       │   │   │   ├── expenses/
│       │   │   │   ├── finance/
│       │   │   │   ├── accounting-export/
│       │   │   │   ├── team/
│       │   │   │   └── settings/
│       │   │   ├── actions/      # Server actions
│       │   │   └── login/
│       │   ├── components/       # React components
│       │   │   ├── ui/           # Base UI components
│       │   │   ├── team/         # Team management
│       │   │   └── expenses/     # Expense components
│       │   ├── lib/              # Utilities
│       │   │   ├── supabase/     # Supabase clients
│       │   │   ├── pdf/          # PDF generation
│       │   │   └── email/        # Email templates
│       │   └── types/            # TypeScript types
│       └── e2e/                  # Playwright tests
├── supabase/
│   ├── migrations/               # SQL migrations (ordered)
│   └── seed/                     # Development seed data
└── .github/
    └── workflows/                # CI/CD pipelines
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase CLI
- Docker (for local Supabase)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/botforce-team/botforce-unity.git
   cd botforce-unity
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start Supabase locally**
   ```bash
   supabase start
   ```

4. **Run migrations and seed data**
   ```bash
   supabase db reset
   ```

5. **Set up environment variables**

   Create `apps/web/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

   # Email (optional for local dev)
   RESEND_API_KEY=<your-resend-key>
   ```

6. **Start the development server**
   ```bash
   pnpm dev
   ```

7. **Open the app**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Default Test Users (Local Development)

After running `supabase db reset`, these users are available:

| Email | Password | Role |
|-------|----------|------|
| admin@botforce.at | password123 | Superadmin |
| employee@botforce.at | password123 | Employee |
| accountant@botforce.at | password123 | Accountant |

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `companies` | Tenant companies (single-tenant MVP, multi-tenant ready) |
| `profiles` | User profiles linked to auth.users |
| `company_members` | User-company-role assignments |
| `customers` | Client companies with address, VAT, reverse charge settings |
| `projects` | Projects under customers with billing type, rates, budgets |
| `project_assignments` | Employee-project access (many-to-many) |
| `time_entries` | Time logs with workflow status and rate snapshots |
| `documents` | Invoices and credit notes with immutability |
| `document_lines` | Invoice line items with per-line tax rates |
| `document_number_series` | Sequential numbering per company/type/year |
| `expenses` | Expense records with approval workflow |
| `files` | File metadata for receipts and attachments |
| `accounting_exports` | Monthly export packages with statistics |
| `accounting_export_lines` | Export line items tracking |
| `audit_log` | Immutable action audit trail |

### Row Level Security (RLS)

All tables have RLS enabled with company_id isolation:

- **Employees**: Can only access assigned projects and own time entries
- **Superadmins**: Full access to all company data
- **Accountants**: Read-only on documents/expenses, can create exports

### Key Database Features

- **Sequential Document Numbers**: Thread-safe function with row-level locking
- **Customer/Company Snapshots**: JSONB storage at issue time for immutability
- **Time Entry Workflow**: Trigger-enforced status transitions
- **Automatic Calculations**: Tax amounts, totals, hours from start/end times
- **Audit Trail**: All critical actions logged with user snapshots

## Austrian Invoicing Compliance

### Document Numbering

- Format: `PREFIX-YEAR-NUMBER` (e.g., `INV-2026-00001`)
- Sequential per company, document type, and year
- Thread-safe generation with row-level locking

### Tax Rates

| Rate | Value | Description |
|------|-------|-------------|
| `standard_20` | 20% | Standard Austrian VAT |
| `reduced_10` | 10% | Reduced rate (food, etc.) |
| `zero` | 0% | Zero-rated (exports, B2B services) |

### Reverse Charge (EU B2B)

- Automatic detection based on customer country and VAT number
- PDF includes required notice in German and English:
  > "VAT reverse charge: The recipient of the service is liable for VAT.
  > Steuerschuldnerschaft des Leistungsempfängers gem. Art. 196 Richtlinie 2006/112/EG."

### Immutability

- Documents locked after issue (only status/payment fields editable)
- Customer and company details snapshotted at issue time
- Line items cannot be modified after issue

## Expense Categories

| Category | Description | Calculation |
|----------|-------------|-------------|
| `mileage` | Kilometergeld | Distance × €0.42/km (Austrian standard) |
| `travel_time` | Reisezeit | Hours × Hourly Rate |
| `reimbursement` | Auslagenersatz | Direct amount entry |

## Accounting Export

The accounting export feature generates monthly packages for accountant handoff:

### Contents

1. **CSV Summary**: All invoices, credit notes, and expenses with:
   - Document numbers and dates
   - Customer/vendor names
   - Net amounts, tax rates, tax amounts
   - Status information

2. **PDF Invoices**: All issued invoices for the period

3. **Receipt Attachments**: Expense receipts (when attached)

### Export Workflow

1. Navigate to Finance → Accounting Export
2. Select date range
3. Preview included items
4. Generate and download ZIP package

## Testing

### Run Tests

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Type checking
pnpm typecheck
```

### RLS Policy Tests

```bash
# Reset database with seed data
supabase db reset

# Run RLS tests
psql $DATABASE_URL -f tests/rls_tests.sql
```

## Deployment

### Vercel (Frontend)

1. Import repository in Vercel
2. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
3. Deploy

### Supabase (Backend)

1. Create project at [supabase.com](https://supabase.com)
2. Link project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
3. Push migrations:
   ```bash
   supabase db push
   ```
4. Configure Storage buckets for receipts

## API Reference

### Server Actions

| Action | File | Description |
|--------|------|-------------|
| `createTimeEntry` | time-entries.ts | Create new time entry |
| `submitTimeEntry` | time-entries.ts | Submit for approval |
| `approveTimeEntry` | time-entries.ts | Approve entry (admin) |
| `bulkApproveTimeEntries` | time-entries.ts | Bulk approval |
| `createDocument` | documents.ts | Create invoice/credit note |
| `issueDocument` | documents.ts | Issue and lock document |
| `generateDocumentPDF` | documents.ts | Generate PDF |
| `sendDocumentByEmail` | documents.ts | Email invoice |
| `createExpense` | expenses.ts | Create expense |
| `approveExpense` | expenses.ts | Approve expense (admin) |
| `uploadReceipt` | expenses.ts | Upload receipt file |
| `createAccountingExport` | finance.ts | Generate export package |
| `getFinancialSummary` | finance.ts | Get financial dashboard data |

## Known Limitations

1. **Single Company**: MVP designed for single company (BOTFORCE GmbH), but schema supports multi-tenant
2. **Bank Integration**: Not implemented (out of scope for MVP)
3. **Recurring Invoices**: Database schema ready, frontend pending
4. **Project Assignment UI**: Database supports it, admin UI pending

## Contributing

1. Create feature branch from `main`
2. Make changes with tests
3. Run `pnpm lint` and `pnpm typecheck`
4. Submit PR for review

## License

Proprietary - BOTFORCE GmbH

## Support

- **Issues**: [GitHub Issues](https://github.com/botforce-team/botforce-unity/issues)
- **Contact**: dev@botforce.at
