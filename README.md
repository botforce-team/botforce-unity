# BOTFORCE Unity

A production-ready invoicing, time tracking, and accounting-prep tool for BOTFORCE GmbH (Austria).

## Features

- **Multi-role Access Control**: Superadmin, Employee, Accountant roles with strict RLS
- **Project & Time Tracking**: Employees log time to assigned projects with approval workflow
- **Austrian Invoicing**: Sequential document numbers, immutable invoices, PDF generation
- **Expense Management**: Track and attach receipts
- **Accounting Export**: Monthly CSV + documents package for accountant handoff

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Postgres, Auth, Storage, RLS, Edge Functions)
- **Deployment**: Vercel (frontend) + Supabase Cloud (backend)

## Project Structure

```
botforce-unity/
├── apps/
│   └── web/                 # Next.js application
│       ├── src/
│       │   ├── app/         # App Router pages
│       │   ├── components/  # React components
│       │   ├── lib/         # Utilities, Supabase client
│       │   └── types/       # TypeScript types
│       └── ...
├── supabase/
│   ├── migrations/          # SQL migrations (ordered)
│   ├── functions/           # Edge Functions
│   └── seed/                # Seed data for development
├── tests/                   # Test files and scripts
└── docs/                    # Documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
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

4. **Run migrations**
   ```bash
   supabase db reset
   ```

5. **Start the development server**
   ```bash
   cd apps/web
   pnpm dev
   ```

6. **Open the app**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `companies` | Tenant companies |
| `profiles` | User profiles linked to auth.users |
| `company_members` | User-company-role assignments |
| `customers` | Client companies |
| `projects` | Projects under customers |
| `project_assignments` | Employee-project access |
| `time_entries` | Time logs with workflow status |
| `documents` | Invoices and credit notes |
| `document_lines` | Invoice line items |
| `expenses` | Expense records |
| `files` | File metadata (receipts, etc.) |
| `accounting_exports` | Monthly export packages |
| `audit_log` | Action audit trail |

### Time Entry Workflow

```
draft → submitted → approved → invoiced
           ↓            ↓
       rejected     rejected
```

### Document Statuses

- `draft` - Being edited
- `issued` - Finalized and sent
- `paid` - Payment received
- `cancelled` - Voided (with credit note reference)

## Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **SUPERADMIN** | Full access to all company data |
| **EMPLOYEE** | View assigned projects, manage own time entries |
| **ACCOUNTANT** | Read-only on documents/expenses, create exports |

## Testing

```bash
# Run RLS policy tests
supabase db reset
psql $DATABASE_URL -f tests/rls_tests.sql

# Run application tests
cd apps/web
pnpm test
```

## Deployment

### Vercel

1. Import repository in Vercel
2. Set environment variables
3. Deploy

### Supabase

1. Create project at supabase.com
2. Link: `supabase link --project-ref your-ref`
3. Push migrations: `supabase db push`

## License

Proprietary - BOTFORCE GmbH

## Support

Contact: dev@botforce.at
