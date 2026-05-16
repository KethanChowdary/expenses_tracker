# Expense Tracker - Codebase Documentation

## 📋 Project Overview

**Expense Tracker** is a full-stack personal finance management application that allows users to track income and expenses, import transactions from CSV/Excel files, categorize spending, and visualize financial data.

The application consists of:
- **Backend**: FastAPI REST API with SQLAlchemy ORM
- **Frontend**: Next.js 15 with React 19, TailwindCSS, and TypeScript

---

## 🛠 Tech Stack

### Backend
- **Framework**: FastAPI 0.115.0
- **Server**: Uvicorn 0.30.6
- **Database**: SQLAlchemy 2.0.35 with SQLite
- **Migrations**: Alembic 1.13.3
- **Validation**: Pydantic 2.9.2
- **File Processing**: openpyxl (Excel), xlrd (legacy .xls), pdfplumber (PDF), msoffcrypto-tool (encrypted Office files)
- **Python**: 3.x

### Frontend
- **Framework**: Next.js 15.2.4
- **UI Library**: React 19
- **Styling**: TailwindCSS 4
- **Language**: TypeScript 5
- **HTTP Client**: Axios 1.8
- **State Management**: Zustand 5
- **Data Fetching**: TanStack React Query 5
- **Charts**: Recharts 2.15
- **PWA Support**: manifest.json

---

## 📁 Project Structure

```
expense_tracker/
├── backend/
│   ├── alembic.ini                 # Database migration config
│   ├── requirements.txt            # Python dependencies
│   ├── alembic/
│   │   └── versions/              # Database migration scripts
│   └── app/
│       ├── __init__.py
│       ├── main.py                # FastAPI app entry point
│       ├── database.py            # SQLAlchemy setup & DB connection
│       ├── models.py              # SQLAlchemy ORM models
│       ├── schemas.py             # Pydantic request/response schemas
│       └── routers/
│           ├── imports.py         # CSV/Excel/PDF import endpoints
│           └── transactions.py    # Transaction CRUD endpoints
└── frontend/
    ├── package.json               # Node.js dependencies
    ├── tsconfig.json              # TypeScript config
    ├── tailwind.config.ts         # TailwindCSS config
    ├── next.config.ts             # Next.js config
    ├── next-env.d.ts              # TypeScript types for Next.js
    ├── app/
    │   ├── layout.tsx             # Root layout (PWA setup)
    │   ├── page.tsx               # Main dashboard page
    │   ├── providers.tsx          # React Query & Zustand providers
    │   └── globals.css            # Global styles
    ├── components/
    │   └── layouts/
    │       ├── AppShell.tsx       # Main layout wrapper
    │       ├── Header.tsx         # Top navigation bar
    │       ├── BottomNav.tsx      # Mobile bottom navigation
    │       ├── dashboard/
    │       │   ├── DashboardPage.tsx     # Dashboard container
    │       │   └── SummaryCards.tsx      # Summary statistics
    │       ├── transactions/
    │       │   ├── TransactionsPage.tsx  # Transactions list view
    │       │   ├── TxItem.tsx            # Individual transaction item
    │       │   └── QuickAdd.tsx          # Quick add transaction form
    │       └── imports/
    │           └── CsvImportPage.tsx     # File upload & import
    ├── lib/
    │   ├── api.ts                 # Axios instance & API endpoints
    │   ├── categories.ts          # Category constants/utilities
    │   └── queryClient.ts         # React Query client setup
    ├── store/                     # Zustand state management
    └── public/
        └── manifest.json          # PWA manifest
```

---

## 🗄 Database Schema

### Transaction Model

```python
class Transaction(Base):
    __tablename__ = "transactions"
    
    id              : Integer (PK)
    amount          : Float (required, > 0)
    type            : Enum (expense | income)
    category        : String(50)
    merchant        : String(100, nullable)
    description     : String(255, nullable)
    source          : String(50) # "manual" | "csv" | "xlsx" | "pdf" | "nlp"
    transaction_date: Date (defaults to today)
    created_at      : DateTime (defaults to now)
```

**Indexes**: `id` (primary key)

---

## 🔌 API Endpoints

### Base URL
- **Development**: `http://localhost:8000/api`
- **Environment Variable**: `NEXT_PUBLIC_API_URL`

### Health Check
```
GET /health
Response: { "status": "ok" }
```

### Transaction Endpoints
Prefix: `/api/transactions`

#### List Transactions
```
GET /transactions/
Query Parameters:
  - skip: int (default: 0) - pagination offset
  - limit: int (default: 50, max: 200) - items per page
  - type: string (optional) - filter by "expense" or "income"
  - category: string (optional) - filter by category
Response: Transaction[]
```

#### Create Transaction
```
POST /transactions/
Body: {
  amount: float (required, > 0),
  type: "expense" | "income" (default: "expense"),
  category: string (default: "Uncategorized"),
  merchant?: string,
  description?: string,
  source?: string (default: "manual"),
  transaction_date?: date (default: today)
}
Response: Transaction (with id, created_at)
Status: 201
```

#### Get Single Transaction
```
GET /transactions/{tx_id}
Response: Transaction
Status: 200 | 404
```

#### Update Transaction
```
PATCH /transactions/{tx_id}
Body: { amount?, type?, category?, merchant?, description?, transaction_date? }
Response: Transaction
Status: 200 | 404
```

#### Delete Transaction
```
DELETE /transactions/{tx_id}
Status: 204 | 404
```

### Import Endpoints
Prefix: `/api/imports`

#### Upload & Import File
```
POST /imports/upload
Form Data:
  - file: MultipartFile (CSV, XLSX, XLS, PDF)
  - mapping: JSON string of column mapping
  - duplicate_handling: "skip" | "merge" | "replace"
Query Parameters:
  - auto_categorize: boolean (default: false)
Response: {
  success: int,
  failed: int,
  details: ImportResult[]
}
Status: 200 | 400 | 422
```

---

## 🚀 Frontend Architecture

### Key Components

#### Layout Components
- **AppShell.tsx**: Wraps all pages with Header + BottomNav
- **Header.tsx**: Top navigation with logo/title
- **BottomNav.tsx**: Mobile-friendly bottom navigation menu (Dashboard, Transactions, Imports)

#### Page Components
- **DashboardPage.tsx**: Main dashboard with summary statistics
- **SummaryCards.tsx**: Card components showing total income, expenses, net balance
- **TransactionsPage.tsx**: Paginated transaction list
- **TxItem.tsx**: Individual transaction row/card
- **QuickAdd.tsx**: Inline form to quickly add transactions
- **CsvImportPage.tsx**: File upload and import workflow

### State Management (Zustand)
Located in `store/` directory. Likely manages:
- Selected transaction filters
- Modal/form states
- Loading states
- Pagination

### Data Fetching (React Query)
- Configured in `lib/queryClient.ts`
- Used for:
  - GET transaction lists (cached with stale time)
  - POST/PATCH/DELETE operations (with automatic invalidation)
  - File uploads

### API Integration
- **`lib/api.ts`**: Axios instance with base URL configuration
- **`txApi` object methods**:
  - `list(params?)`: GET `/transactions/` with optional filters
  - `create(data)`: POST `/transactions/`
  - `update(id, data)`: PATCH `/transactions/{id}`
  - `delete(id)`: DELETE `/transactions/{id}`

### Styling
- **TailwindCSS 4**: Utility-first CSS framework
- **globals.css**: Global styles and theme setup
- **PWA Support**: Mobile-friendly viewport and app configuration

---

## 📤 File Import Feature

### Supported Formats
1. **CSV** - Comma-separated values
2. **XLSX** - Modern Excel (via openpyxl)
3. **XLS** - Legacy Excel (via xlrd 1.x)
4. **PDF** - Table extraction (via pdfplumber)

### Import Processing Pipeline

#### CSV Parser (`parse_csv`)
- Detects UTF-8 with BOM
- Handles DictReader format
- Returns headers and rows

#### Excel Parser (`parse_xlsx`)
- Tries openpyxl first (true .xlsx)
- Falls back to xlrd for legacy .xls files
- Auto-detects header row (first row with 2+ non-empty cells)
- Skips empty rows

#### PDF Parser (`read_pdf`)
- Extracts tables from each page
- Deduplicates across pages
- Converts to standardized row format

#### Data Transformation
- **Amount Parsing**: Removes currency symbols (₹, $) and thousand separators
- **Date Parsing**: Supports multiple formats:
  - `%d/%m/%Y`, `%Y-%m-%d`, `%m/%d/%Y`, `%d-%m-%Y`
  - `%d %b %Y`, `%Y/%m/%d`, `%d-%b-%Y`, `%b %d, %Y`

#### Duplicate Detection
- **Row Fingerprint**: MD5 hash of all column values
- Used to prevent duplicate imports

#### Column Mapping
- User selects which columns map to transaction fields
- Smart matching of header names to fields
- Supports custom field mappings

---

## 🔧 Backend Architecture Details

### Database Layer (`app/database.py`)
- SQLAlchemy engine with SQLite
- Session factory for dependency injection
- `get_db()`: Generator yielding DB session per request

### Models Layer (`app/models.py`)
- SQLAlchemy declarative models
- Transaction model with enum types
- Auto-increment IDs
- Automatic timestamps

### Schemas Layer (`app/schemas.py`)
- Pydantic v2 models for validation
- **TransactionCreate**: Request schema for POST
- **TransactionUpdate**: Request schema for PATCH (all fields optional)
- **TransactionOut**: Response schema (includes id, created_at)
- Field validation: amounts must be > 0

### Routers Layer (`app/routers/`)
- **transactions.py**: Standard CRUD operations
- **imports.py**: File upload and data import
- Both use dependency injection for DB session

### CORS Configuration
- Allowed Origins: `http://localhost:3000` (frontend dev server)
- Methods: All
- Headers: All

---

## 🏃 Running the Application

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:3000
```

### Environment Variables
**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

**Backend** (`.env`):
```
DATABASE_URL=sqlite:///./expenses.db
DEBUG=true
```

---

## 🔄 Data Flow

### Creating a Transaction
1. **Frontend**: User fills QuickAdd form
2. **Frontend**: Form submission calls `txApi.create(data)`
3. **Frontend**: Axios POST to `/api/transactions/`
4. **Backend**: FastAPI validates with TransactionCreate schema
5. **Backend**: Creates Transaction record in DB
6. **Backend**: Returns TransactionOut with id and created_at
7. **Frontend**: React Query invalidates and refetches transaction list
8. **Frontend**: UI updates with new transaction

### Importing Transactions
1. **Frontend**: User uploads CSV/Excel file on CsvImportPage
2. **Frontend**: Form submission with file and column mapping
3. **Frontend**: Axios POST to `/api/imports/upload` (multipart form data)
4. **Backend**: Detects file type and parses content
5. **Backend**: Maps columns to transaction fields
6. **Backend**: Validates amounts and dates
7. **Backend**: Checks for duplicates using fingerprint
8. **Backend**: Bulk inserts valid transactions
9. **Backend**: Returns success/failure counts and details
10. **Frontend**: Shows import results summary
11. **Frontend**: Refetches transaction list

### Filtering Transactions
1. **Frontend**: User selects filters (type, category, date range)
2. **Frontend**: Form submission triggers `txApi.list({ type: "expense", category: "Food" })`
3. **Backend**: Query builder filters on transaction.type and transaction.category
4. **Backend**: Returns filtered results ordered by transaction_date DESC
5. **Frontend**: React Query caches results
6. **Frontend**: UI displays filtered list

---

## 🎯 Key Features

### Transaction Management
- ✅ Create, read, update, delete transactions
- ✅ Support for income and expense types
- ✅ Categorization and merchant tracking
- ✅ Multiple sources (manual, CSV, XLSX, PDF, NLP-ready)
- ✅ Transaction date tracking
- ✅ Timestamps for audit trail

### Bulk Import
- ✅ CSV, Excel (.xlsx, .xls), PDF support
- ✅ Smart header detection
- ✅ Flexible date format parsing
- ✅ Currency symbol handling
- ✅ Duplicate detection
- ✅ Column mapping UI
- ✅ Batch processing

### Analytics & Dashboard
- ✅ Summary statistics (total income, expenses, net)
- ✅ Transaction list with filters
- ✅ Category and type filtering
- ✅ Pagination support
- ✅ Recharts integration ready for visualizations

### User Experience
- ✅ PWA support (installable on mobile)
- ✅ Responsive design (TailwindCSS)
- ✅ Real-time updates (React Query)
- ✅ Quick add form for rapid data entry
- ✅ Tabler icons for consistent iconography

### Developer Experience
- ✅ Type safety (TypeScript + Pydantic)
- ✅ Hot reload (Next.js dev server + Uvicorn)
- ✅ SQLAlchemy ORM for migrations
- ✅ Axios interceptors ready for auth/error handling

---

## 🔐 Security Considerations

- CORS configured for localhost development only (update for production)
- Input validation via Pydantic schemas
- SQL injection protection via SQLAlchemy parameterized queries
- File upload validation (MIME type, size limits - add as needed)
- No authentication/authorization currently (add token-based auth for production)

---

## 📊 Future Enhancements

1. **Authentication**: JWT-based user authentication
2. **Multi-user Support**: Per-user transaction isolation
3. **Advanced Analytics**: Charts, trends, budget alerts
4. **Recurring Transactions**: Automatic bill creation
5. **Receipt Upload**: OCR for receipt processing
6. **Mobile App**: React Native version
7. **Blockchain**: Transaction verification/audit trail
8. **API Rate Limiting**: Prevent abuse
9. **Backup/Export**: Data portability
10. **Notifications**: Budget alerts, spending reminders

---

## 🚨 Common Issues & Troubleshooting

### CORS Error
**Issue**: Frontend can't connect to backend
**Solution**: Ensure `NEXT_PUBLIC_API_URL` matches backend URL and CORS allow_origins includes frontend origin

### File Upload Fails
**Issue**: CSV/Excel import throws error
**Solution**: Ensure file format matches detector (magic bytes). Check file encoding (UTF-8 expected)

### Database Lock
**Issue**: SQLite database is locked
**Solution**: Close other connections. Consider PostgreSQL for concurrent access

### Type Errors in Frontend
**Issue**: TypeScript errors after schema changes
**Solution**: Regenerate types. Update `Transaction` interface in `lib/api.ts`

---

## 📞 Code Navigation

- **Entry Points**: 
  - Backend: `backend/app/main.py`
  - Frontend: `frontend/app/page.tsx`
- **Business Logic**:
  - Routers: `backend/app/routers/*.py`
  - Components: `frontend/components/`
- **Data Models**:
  - Backend: `backend/app/models.py`, `backend/app/schemas.py`
  - Frontend: `frontend/lib/api.ts`
- **Configuration**:
  - Database: `backend/app/database.py`
  - API Client: `frontend/lib/queryClient.ts`

---

## 📝 Notes for AI Assistant

When responding to prompts about this codebase:
1. **Backend is FastAPI** - REST API patterns, dependency injection (Depends), type hints with Pydantic
2. **Frontend is Next.js** - Server/Client components, App Router, React hooks, React Query for async
3. **Database is SQLite with SQLAlchemy ORM** - No raw SQL needed, use declarative models
4. **Import feature is complex** - Multiple file format parsers, column mapping, duplicate detection
5. **No authentication** - All endpoints are currently public
6. **PWA ready** - manifest.json and viewport setup in place
7. **Mobile-first** - Responsive design with bottom navigation
8. **Type-safe** - Both Python (Pydantic) and TypeScript enforce types
9. **Development mode** - CORS limited to localhost:3000, SQLite for dev/testing

---

**Last Updated**: 2026-05-16
