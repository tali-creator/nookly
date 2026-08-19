# Nookly

A marketplace where Nigerian artisans and service providers can list their businesses and customers can discover, favorite, and message them.

## Repo layout

- `nookly-backend/` — Node.js + Express + Prisma + PostgreSQL API (port 4000)
- `nookly-frontend/` — static HTML/CSS/JS site served by `serve.py` (port 8080)

## Backend setup

1. `cd nookly-backend && npm install`
2. Create `.env` from the template: `cp .env.example .env`, then fill in real values (database URL, JWT secret, etc.).
3. Apply the schema and seed an admin: `npx prisma migrate deploy && npx prisma db seed`
4. Run: `npm run dev`

## Frontend

The frontend is plain static files with no build step. Serve it from `nookly-frontend/`:

```sh
python3 serve.py
```

then open `http://localhost:8080`.

## Verification

- Backend health: `curl http://localhost:4000/health`
- Typecheck backend: `npx tsc --noEmit`

> Note: `.env`, `node_modules/`, and user uploads (business photos, KYC documents) are gitignored and never committed.