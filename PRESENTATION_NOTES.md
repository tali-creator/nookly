## What is Nookly?

**Nookly is a marketplace web application that connects local artisans and
service providers (tailors, caterers, salons, cleaners, repair services, etc.)
with customers.** Businesses can create a profile, list their services with
prices, upload photos, and get discovered by nearby customers — who can then
browse, favorite, and chat with them directly.

The app has three user areas:

- **Customer / Marketplace** — browse businesses by category or proximity,
  view service prices, favorite listings, send messages.
- **Business Owner** — sign up, complete KYC (identity verification), create
  and manage listings, upload photos, view visitor analytics and a message
  inbox, receive notifications.
- **Admin** — review and approve/reject/suspend business listings, review KYC
  submissions, manage users.

---

## Tech Stack

| Layer     | Technology                                                        |
| --------- | ----------------------------------------------------------------- |
| Frontend  | HTML, CSS, vanilla JavaScript (no framework), multi-page app      |
| Backend   | Node.js, Express (v5), TypeScript                                 |
| Database  | PostgreSQL via Prisma ORM (v7), migrations                        |
| Auth      | JWT + Bcrypt, role-based access (customer / owner / admin)        |
| Real-time | Socket.IO (live notifications)                                    |
| Validation| Zod                                                               |
| Uploads   | Multer (content-verified file uploads)                            |
| Email     | Resend                                                            |

---

## What is the database made of?

**PostgreSQL** with **15+ tables** managed by Prisma. Key models:

- `User` — customers and business owners (name, email, role, KYC status)
- `Business` — listings (name, category, description, address, photos, status)
- `ServiceItem` — services offered with prices
- `Category` — business categories
- `Photo` — uploaded business/avatar images
- `KycSubmission` — identity verification documents (selfie, certificate, proof of address)
- `Conversation` / `Message` — customer↔owner chat threads
- `Notification` — in-app notifications
- `Favorite` — saved businesses
- `BusinessHours` — opening hours
- `OwnerVisit` — visitor analytics
- `AnalyticsEvent`, `AuditLog`, `PasswordResetToken`

---

## How it works — key flows

### Authentication
- Passwords are **hashed with Bcrypt** (never stored in plain text).
- On login the server issues a **JWT** (user ID + role, 7-day expiry).
- Middleware enforces roles on protected routes (e.g. only admins review
  businesses).
- Tokens are **invalidated on password change** (the token records when the
  password last changed; the server compares it to the current value).
- Socket.IO authenticates with the same JWT.

### Business onboarding (moderation workflow)
1. User signs up as a business owner.
2. Owner completes **KYC** — uploads ID documents (selfie, certificate, proof
   of address), encrypted at rest (AES-256-GCM).
3. Admin reviews and verifies the KYC submission.
4. Owner creates a business listing with services and prices.
5. Admin reviews and **approves** the listing before it goes live.
6. Only approved, KYC-verified businesses appear in the marketplace.

### Customer journey
- **Discover** — browse by category or nearby (geolocation, with fallback).
- **Compare** — see services and starting prices.
- **Save** — favorite businesses.
- **Contact** — message the owner directly; owner gets a live notification
  and replies from an inbox with unread tracking.
- **Search** — filter by category, location, and radius.

### Admin panel
- Moderation dashboard with pending/approved/rejected/suspended counts.
- Approve, reject (with reason), or suspend listings.
- Verify/reject owner KYC submissions.
- Manage all users (view, create, archive).
- Feature businesses (featured badge in the marketplace).

---

## Security

- **Zod** validates every request (body, query, params) before controllers.
- **Uploads are content-verified** — magic bytes are checked against the actual
  file contents, so a renamed `.exe` is rejected even if the filename says PNG.
- File names are regenerated server-side as random UUIDs (prevents path
  traversal).
- **KYC documents are encrypted and never served publicly** — streamed only
  through authenticated routes with permission checks.
- HTTP security headers on all responses; CORS restricted to configured
  frontend origins.
- Rate limiting on auth and sensitive endpoints.

---

## Frontend organization

- Multi-page static site:
  - Marketplace: `index.html`, `business.html`, `dashboard.html`, `favorites.html`
  - Owner: `owner/dashboard.html`, `owner/business-form.html`, `owner/messages.html`,
    `owner/kyc.html`, `owner/analytics.html`
  - Admin: `admin/dashboard.html`, `admin/business.html`, `admin/kyc-review.html`,
    `admin/users.html`
- Shared JS modules: `api.js` (fetch wrapper), `auth.js` (session/guards),
  `cards.js` (business cards), `notifications.js` (live bell).
- Shared HTML **partials** (header, sidebar, icons) injected by `include.js`.
- Served as static files — fast, no build step.

---

## Deployment

- **Frontend:** Vercel (static hosting), serving the `nookly-frontend/`
  directory as the site root.
- **Backend:** a persistent Node/Express process (e.g. **Fly.io**) with a
  managed **PostgreSQL** (e.g. **Neon**).
- Environment variables (database URL, JWT secret, encryption keys) are stored
  as secrets on the host — never in the repo.

---

## Likely questions & answers

### Q: What tech stack are you using?
Frontend: plain HTML, CSS, and vanilla JavaScript (no framework). Backend:
Node.js + Express 5 written in TypeScript. Database: PostgreSQL via Prisma.
Auth: JWT + Bcrypt. Real-time: Socket.IO. Validation: Zod. Uploads: Multer.
Email: Resend.

### Q: What is the database made of?
PostgreSQL with 15+ tables (users, businesses, service items, categories,
photos, KYC submissions, conversations/messages, notifications, favorites,
business hours, owner visits, analytics, audit log, password-reset tokens),
managed with the Prisma ORM and migrations.

### Q: How does authentication work?
Passwords are hashed with Bcrypt. On login the server issues a 7-day JWT
containing the user ID and role. Middleware verifies the token and enforces
roles on every protected route. Changing your password invalidates all old
tokens. Socket.IO uses the same JWT for real-time connections.

### Q: How does business onboarding work?
An owner completes KYC (encrypted ID documents), an admin verifies it, the
owner creates a listing with services and prices, and an admin approves it
before it goes live. Only approved, KYC-verified businesses appear in the
marketplace.

### Q: How do you keep data and uploads secure?
Zod validates every request. Uploads are verified by file content (magic
bytes), not just the claimed extension. Filenames are server-generated UUIDs.
KYC documents are encrypted at rest and never served publicly. Security headers
and CORS restrictions are applied globally, and auth endpoints are rate limited.

### Q: Why no frontend framework?
The app is content-focused and multi-page, so plain HTML/CSS/JS keeps it fast
and simple. The API is fully separate, so React/Vue could be adopted later
without changing the backend.

### Q: How do you prevent someone from uploading a fake image?
We check the file's magic bytes — the actual image signature in the content —
not just the extension, so a renamed executable is rejected. KYC documents are
additionally encrypted and only reachable through authenticated routes.

### Q: What happens when someone changes their password?
Old JWTs stop working immediately, because each token records the time the
password was last changed and the server compares it to the current value on
every request.

### Q: Why TypeScript?
It catches bugs at compile time and self-documents the code — important with
40+ API routes spanning many models.

---

## Quick facts to memorize

- Frontend: HTML + CSS + vanilla JS (static, Vercel)
- Backend: Node.js + Express 5 + TypeScript
- Database: PostgreSQL + Prisma ORM (15+ tables)
- Auth: JWT + Bcrypt, role-based (customer/owner/admin)
- Real-time: Socket.IO notifications
- Validation: Zod; Uploads: Multer (content-verified); Email: Resend
- Key flows: KYC verification → listing approval → marketplace → messaging