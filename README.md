# Fortuna

A full-stack personal finance management platform — track net worth, investment portfolios, income and expenses, all from a single dashboard.

## Features

- **Dashboard** — net worth overview, savings rate, asset allocation, and net worth timeline
- **Assets** — track cash, real estate, vehicles, crypto, stocks, bonds, and other holdings
- **Investments** — portfolio tracker with auto-calculated ROI, profit/loss, and cost basis (stored generated columns)
- **Income** — salary, freelance, dividends, rental, and other income streams with frequency tracking
- **Expenses** — categorized spending with merchant tracking and date filtering
- **Authentication** — email/password registration, email verification, password reset, JWT access + refresh token rotation
- **Analytics** — income vs. expenses, investment performance, and asset allocation charts

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Hook Form, Zod, Recharts, Framer Motion |
| Backend | Node.js, Express, TypeScript, Zod validation, Helmet, CORS, rate limiting |
| Database | PostgreSQL (Neon), UUID primary keys, stored generated columns, migration system |
| Auth | JWT (access + refresh), bcrypt, HTTP-only cookies, email verification via Resend |
| Tooling | oxlint, PostCSS, tsx (dev runner) |

## Project Structure

```
fortuna/
├── frontend/                  React + TypeScript SPA (Vite)
│   └── src/
│       ├── components/        forms/, charts/, layout/, ui/
│       ├── pages/             Dashboard, Assets, Investments, Income, Expenses, Login, Register
│       ├── context/           AuthContext (session state)
│       ├── hooks/             useResource (generic CRUD hook)
│       ├── lib/               API client, Zod schemas, query client
│       └── types/             TypeScript types mirroring the DB schema
│
├── backend/                   Express + TypeScript API
│   └── src/
│       ├── auth/              register, login, refresh, verify, reset
│       ├── users/             current user profile
│       ├── assets/            assets CRUD
│       ├── investments/       investments CRUD (generated ROI columns)
│       ├── income/            income CRUD
│       ├── expenses/          expenses CRUD
│       ├── analytics/         dashboard summary aggregation
│       ├── middleware/        auth guard, error handler
│       ├── utils/             JWT, password hashing, generic CRUD router
│       └── db/                Neon connection pool, migration runner
│
└── database/
    ├── migrations/            numbered SQL files (applied in order)
    ├── schema.sql             combined migrations for fresh setup
    └── queries.sql            reference analytics queries
```

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) account (or any PostgreSQL instance)
- A [Resend](https://resend.com) API key (for email verification)

### 1. Database

```bash
cd backend
cp .env.example .env    # fill in DATABASE_URL
npm install
npm run migrate         # applies database/migrations/*.sql in order
```

### 2. Backend

```bash
cd backend
cp .env.example .env    # fill in JWT secrets, RESEND_API_KEY, etc.
npm install
npm run dev             # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env    # set VITE_API_URL=http://localhost:4000/api
npm install
npm run dev             # http://localhost:5173
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Revoke refresh token |
| POST | `/api/auth/refresh` | Rotate access token |
| GET | `/api/auth/verify/:token` | Verify email address |
| POST | `/api/auth/forgot-password` | Request password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |
| GET | `/api/users/me` | Get current user profile |
| GET/POST/PUT/DELETE | `/api/assets` | Assets CRUD |
| GET/POST/PUT/DELETE | `/api/investments` | Investments CRUD |
| GET/POST/PUT/DELETE | `/api/income` | Income CRUD |
| GET/POST/PUT/DELETE | `/api/expenses` | Expenses CRUD |
| GET | `/api/dashboard` | Aggregated dashboard summary |
| GET | `/api/health` | Health check |

## Security

- Passwords hashed with bcrypt (12 rounds)
- Access tokens stored in memory only; refresh tokens in HTTP-only, `SameSite=Strict` cookies
- Row-level ownership enforced at the query level (`WHERE user_id = $1`)
- All SQL is parameterized — no string concatenation
- Stricter rate limiting on auth endpoints (20 requests / 15 min)
- Helmet security headers enabled

## License

[Apache 2.0](LICENSE) — Copyright 2026 Jovan Paić
