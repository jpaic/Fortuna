# Financial Platform

A personal financial management platform: net worth tracking, investment
portfolio performance, income/expense tracking, and dashboard analytics —
replacing a spreadsheet with a database-driven web app.

## Stack

- **Frontend:** React + TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form + Zod, Recharts
- **Backend:** Node.js + Express + TypeScript
- **Database:** Neon (serverless PostgreSQL)
- **Auth:** JWT (short-lived access token in memory, refresh token in an HTTP-only cookie), bcrypt
- **Email:** Resend (verification, password reset)
- **Deployment:** Vercel (frontend); backend can also deploy to Vercel as serverless functions, or any Node host

## Project structure

```
financial-platform/
├── frontend/               React + TypeScript app (Vite)
│   └── src/
│       ├── components/     forms/, charts/, layout/, ui/
│       ├── pages/          route-level screens
│       ├── context/        AuthContext
│       ├── hooks/          useResource (generic CRUD hook)
│       ├── lib/            api client, zod schemas, query client
│       └── types/          shared TS types (mirrors DB schema)
│
├── backend/                 Express + TypeScript API
│   └── src/
│       ├── auth/            register/login/refresh/verify/reset
│       ├── users/           current-user profile
│       ├── assets/          assets CRUD
│       ├── investments/     investments CRUD (generated ROI columns)
│       ├── income/          income CRUD
│       ├── expenses/        expenses CRUD
│       ├── analytics/       dashboard summary aggregation
│       ├── middleware/      auth guard, error handler
│       ├── utils/           jwt, password hashing, generic CRUD router
│       └── db/               Neon pool + migration runner
│
└── database/
    ├── migrations/          numbered .sql files, applied in order
    ├── schema.sql           combined migrations, for fresh setup
    └── queries.sql          reference analytics queries used by the backend
```

## Getting started

### 1. Database

Create a Neon project, then apply the schema:

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL from the Neon dashboard
npm install
npm run migrate             # applies database/migrations/*.sql in order
```

### 2. Backend

```bash
cd backend
npm run dev                 # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev                 # http://localhost:5173
```

## Security notes

- Passwords are hashed with bcrypt (12 rounds), never stored or logged in plaintext.
- Access tokens live in memory on the client only; refresh tokens are HTTP-only, `SameSite=Strict` cookies scoped to `/api/auth`.
- Every database query for assets/investments/income/expenses is scoped to `WHERE user_id = $1` — ownership is enforced at the query level, not just checked in application code.
- All SQL is parameterized (see `backend/src/db/pool.ts`); there is no string-concatenated SQL anywhere in the codebase.
- Auth endpoints have a stricter rate limit (20 requests / 15 min) than the rest of the API.
