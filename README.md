# PayPilot AI

**AI-powered invoice and payment management platform for small businesses, freelancers, and independent service providers.**

> ⚠️ This is a development/hackathon MVP. PayPal payments use Sandbox credentials (no real money is processed). The AI assistant uses a deterministic financial engine (no external LLM required). Email reminders are simulated by default.

---

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Quick Start (Local Development)](#quick-start-local-development)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Demo Credentials](#demo-credentials)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [Docker Deployment](#docker-deployment)
- [Feature Status](#feature-status)
- [Security Notes](#security-notes)

---

## Features

### ✅ Implemented

| Module | Features |
|--------|----------|
| **Auth** | Registration, login, JWT auth, bcrypt passwords, business profiles |
| **Dashboard** | Real-time KPIs, monthly bar chart, invoice status pie chart, recent activity |
| **Invoices** | Full CRUD, line items, status lifecycle, partial payments, overdue detection |
| **Customers** | Create/edit, invoice history, payment summary per customer |
| **Payments** | PayPal Sandbox checkout, server-side order creation & capture, reconciliation |
| **Webhooks** | Signature verification, idempotent processing, audit trail, synthetic test mode |
| **AI Assistant** | 9 tools, natural-language queries, payment reminders, conversation history |
| **Reminders** | AI-drafted reminders with tone selection, simulated delivery audit log |
| **Analytics** | Receivables aging report, monthly trend chart, CSV export |
| **Settings** | Business profile update, system status display |

### 🔮 Planned (Not Yet Implemented)

- Real PayPal production credentials
- Live LLM integration (Gemini / OpenAI)
- Real SMTP email delivery
- Multi-user business roles (owner, accountant, viewer)
- PDF invoice generation
- Recurring invoice scheduling
- Stripe / Razorpay payment gateway alternatives
- Mobile app

---

## Technology Stack

### Frontend
- **React 18** + **TypeScript** — UI framework
- **Vite** — build tool and dev server
- **Tailwind CSS** — utility-first styling
- **React Router v6** — client-side routing
- **Recharts** — charts and data visualization
- **React Hook Form** + **Zod** — form handling and validation
- **Axios** — HTTP client with auth interceptors
- **Lucide React** — icon library

### Backend
- **Python 3.12** + **FastAPI** — web framework
- **SQLAlchemy 2.x** — ORM with sync driver
- **Alembic** — database migrations
- **SQLite** (development) / **PostgreSQL** (production)
- **bcrypt** — password hashing
- **PyJWT** — JWT token creation and verification
- **HTTPX** — async HTTP client for PayPal API
- **Pydantic v2** + **pydantic-settings** — data validation and settings
- **Pytest** — test framework

---

## Quick Start (Local Development)

### Prerequisites

- **Python 3.11+** — [python.org](https://www.python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Git** — [git-scm.com](https://git-scm.com/)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/paypilot-ai.git
cd paypilot-ai
```

### 2. Configure environment

```bash
cp .env.example backend/.env
```

Edit `backend/.env` with your settings. Defaults work for development without any real credentials.

### 3. Set up the backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will automatically:
- Create the SQLite database (`paypilot.db`)
- Run all table migrations
- Seed demo data (business: "Apex Digital Agency", user: `demo@paypilot.ai`)

API docs available at: http://localhost:8000/docs

### 4. Set up the frontend

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Frontend available at: http://localhost:5173

---

## Project Structure

```
paypilot-ai/
├── backend/
│   ├── app/
│   │   ├── api/            # Route handlers (auth, invoices, customers, ...)
│   │   ├── core/           # Config and security utilities
│   │   ├── db/             # Database session, seed data
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic layer
│   │   └── main.py         # FastAPI app entry point
│   ├── alembic/            # Database migration scripts
│   ├── tests/              # Pytest test suite
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── layout/     # AppLayout, Sidebar, TopNav
│   │   │   ├── payments/   # PayPalModal
│   │   │   ├── reminders/  # ReminderModal
│   │   │   └── ui/         # Badge, Card, StatCard, Modal, EmptyState
│   │   ├── hooks/          # useAuth context
│   │   ├── pages/          # Page components (one per route)
│   │   ├── services/       # api.ts — Axios client + all API functions
│   │   ├── types/          # TypeScript type definitions
│   │   ├── App.tsx         # Router setup
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

## Demo Credentials

| Field | Value |
|-------|-------|
| **Email** | `demo@paypilot.ai` |
| **Password** | `DemoPassword123!` |
| **Business** | Apex Digital Agency (Demo) |

The demo account includes:
- 5 customers (TechCorp Solutions, StartupHub Inc., Creative Works Studio, DataVault Systems, RetailPlus Chain)
- 6 invoices in various states (draft, issued, partially paid, paid, overdue)
- Payment history
- Pre-seeded data for dashboard charts

---

## API Reference

Interactive API documentation is available at http://localhost:8000/docs (Swagger UI) or http://localhost:8000/redoc.

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Create a new user account |
| `POST` | `/api/auth/login` | Login and receive JWT token |
| `GET` | `/api/auth/me` | Get current user + business |
| `PATCH` | `/api/auth/business` | Update business profile |
| `GET` | `/api/dashboard/summary` | Dashboard KPIs |
| `GET` | `/api/dashboard/monthly-summary` | Monthly invoiced vs collected |
| `GET` | `/api/invoices` | List invoices (with filters) |
| `POST` | `/api/invoices` | Create invoice |
| `GET` | `/api/invoices/{id}` | Invoice details |
| `PUT` | `/api/invoices/{id}` | Update invoice |
| `POST` | `/api/invoices/{id}/issue` | Issue a draft invoice |
| `POST` | `/api/invoices/{id}/cancel` | Cancel an invoice |
| `POST` | `/api/invoices/{id}/checkout` | Create PayPal checkout order |
| `POST` | `/api/payments/{id}/capture` | Capture PayPal payment |
| `POST` | `/api/webhooks/paypal` | PayPal webhook receiver |
| `POST` | `/api/webhooks/test` | Synthetic webhook test (dev only) |
| `POST` | `/api/ai/chat` | AI assistant message |
| `GET` | `/api/ai/conversations` | List chat conversations |
| `GET` | `/api/analytics/aging` | Receivables aging report |
| `GET` | `/api/analytics/export` | Export invoices as CSV |

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | *(required)* | JWT signing secret — generate with `openssl rand -hex 32` |
| `DATABASE_URL` | `sqlite:///./paypilot.db` | Database connection string |
| `PAYPAL_MODE` | `sandbox` | `sandbox` or `live` |
| `PAYPAL_CLIENT_ID` | placeholder | PayPal app client ID |
| `PAYPAL_CLIENT_SECRET` | placeholder | PayPal app client secret |
| `AI_PROVIDER` | *(empty)* | `gemini`, `openai`, or blank for deterministic engine |
| `SMTP_ENABLED` | `false` | Set to `true` to send real emails |

---

## Running Tests

```bash
cd backend

# Activate venv first
venv\Scripts\activate   # Windows
source venv/bin/activate # macOS/Linux

# Run all tests
pytest

# With verbose output
pytest -v

# Run specific module
pytest tests/test_invoices.py -v
```

**Current test results:** 15/15 tests passing

Tests cover:
- User registration and authentication
- Password hashing and JWT validation
- Invoice CRUD and status lifecycle
- Overdue detection logic
- Payment recording and balance calculation
- AI tool dispatch and response structure
- Dashboard analytics aggregation

Tests run entirely at the service layer (no live database, no network, no credentials required).

---

## Docker Deployment

### Development with Docker Compose

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Start all services
docker-compose up --build

# Access:
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Production Considerations

1. Set a strong `SECRET_KEY` in `.env`
2. Use PostgreSQL by setting `DATABASE_URL` appropriately
3. Set `PAYPAL_MODE=live` and provide real PayPal credentials
4. Configure SMTP for real email delivery
5. Use a reverse proxy (nginx) in front of both services
6. Enable HTTPS
7. Set `CORS_ORIGINS` to your actual frontend domain
8. Remove `SEED_DEMO_DATA=true` in production

---

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| User registration & login | ✅ Working | JWT-based, bcrypt hashed |
| Business profile | ✅ Working | CRUD via API and Settings page |
| Invoice CRUD | ✅ Working | Full lifecycle with line items |
| Invoice status transitions | ✅ Working | Draft→Issued→Paid with guards |
| Overdue detection | ✅ Working | Recalculated on every load |
| Customer management | ✅ Working | With payment summary |
| Dashboard charts | ✅ Working | Live data from database |
| PayPal Sandbox checkout | ✅ Working | Mock mode (no real PayPal account needed) |
| Payment capture | ✅ Working | Server-side, idempotent |
| Webhook verification | ✅ Working | Signature check (mock in dev) |
| AI assistant | ✅ Working | 9 tools, deterministic engine |
| Payment reminders | ✅ Working | Drafted by AI, simulated delivery |
| Analytics / aging | ✅ Working | Bucket breakdown + CSV export |
| Real LLM (Gemini/OpenAI) | 🔮 Planned | Add API key to enable |
| Real PayPal live | 🔮 Planned | Set `PAYPAL_MODE=live` |
| Real email delivery | 🔮 Planned | Configure SMTP settings |
| PDF invoice generation | 🔮 Planned | — |
| Multi-user roles | 🔮 Planned | — |

---

## Security Notes

- Passwords are **never stored in plaintext** — bcrypt with cost factor 12
- JWTs expire after configurable duration and are validated on every request
- **Never trust browser-reported payment amounts** — all amounts calculated server-side
- PayPal client secret is **never sent to the frontend**
- Every protected resource validates business ownership on the backend
- Webhook events are **deduplicated** via unique constraint on `(provider, event_id)`
- Invoice fields cannot be changed after payment without an explicit adjustment workflow
- All environment secrets are loaded from `.env` — never hardcoded

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

*Built for a technical hackathon demonstration. Not for production financial use without additional security review.*
