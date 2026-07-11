# Fortuna

A personal finance management platform for tracking net worth, investments, income, and expenses — replacing spreadsheets with a proper database-backed web app.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, Recharts
- **Backend:** Node.js, Express, TypeScript, Zod validation
- **Database:** PostgreSQL (Neon), migrations system
- **Auth:** JWT (access + refresh), bcrypt, HTTP-only cookies, email verification via Resend
- **Deployment:** Vercel

## Project Structure

```
fortuna/
├── frontend/              React + TypeScript SPA (Vite)
│   ├── components/        forms, charts, layout, ui
│   ├── pages/             Dashboard, Assets, Investments, Income, Expenses, Auth
│   ├── context/           Auth, Currency (live exchange rates)
│   └── lib/               API client, Zod schemas
│
├── backend/               Express + TypeScript API
│   ├── auth/              register, login, refresh, verify, reset
│   ├── assets/            assets CRUD
│   ├── investments/       investments CRUD
│   ├── income/            income CRUD
│   ├── expenses/          expenses CRUD
│   ├── analytics/         dashboard summary aggregation
│   └── utils/             JWT, generic CRUD router
│
└── database/
    └── migrations/        numbered SQL files applied in order
```

## License

[Apache 2.0](LICENSE) — Copyright 2026 Jovan Paić
