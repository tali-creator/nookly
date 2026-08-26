# Nookly — Code Architecture & Defense Guide

> Purpose of this document: a single, readable reference that explains how the
> Nookly codebase is organised, how the most important functions work, how the
> pieces connect, and the naming/file-saving conventions. It is meant to be read
> end-to-end before a project defense so you can explain the code with confidence.

---

## 1. What Nookly is

Nookly is a two-part web platform that connects customers with **trusted local
service businesses** (plumbers, salons, tutors, etc.) near them.

- A **customer** browses businesses by category / location, saves favourites
  (no account needed), and messages an owner.
- A **business owner** creates a business profile, uploads photos/services,
  completes KYC, and answers messages.
- An **admin** reviews KYC submissions and moderates businesses.

It is a **monorepo** with two independently deployable apps:

```
pheobe/
├── nookly-backend/          # Express + Prisma REST API (deploys to Render)
└── nookly-frontend-next/    # Next.js (App Router) PWA (deploys to Vercel)
```

---

## 2. Function-count snapshot (for context)

Counted as *named* functions only (declarations, named arrow assignments, class
methods); anonymous inline callbacks (`.map()`, event handlers, route handlers)
are **not** counted. This is why the numbers are conservative.

| Side | Source files | Functions |
|------|--------------|-----------|
| Backend (`nookly-backend/src`) | 76 | **152** |
| Frontend (`nookly-frontend-next/src`) | 75 | **227** |

The frontend is function-heavier because **every React component is a function**
and there are many small `lib/*` helpers. Backend functions cluster in
`controllers/` and `routes/`.

---

## 3. BACKEND — how it works

### 3.1 Boot sequence (entry → app)

**`src/index.ts`** (17 lines) is the process entry point:

1. `createApp()` builds the Express app.
2. `createServer(app)` wraps it in an HTTP server.
3. `initSocket(server)` attaches Socket.IO to the *same* HTTP server (so realtime
   notifications share the port).
4. `server.listen(env.port, "0.0.0.0", …)` binds to all interfaces — required
   inside the Render container.

**`src/app.ts`** (`createApp()`) assembles the middleware stack in order:

| Order | Middleware | What it does |
|-------|-----------|--------------|
| 1 | `helmet({ crossOriginResourcePolicy: "cross-origin" })` | Security headers. `cross-origin` is required because the frontend loads public images directly from a different origin (R2 bucket). |
| 2 | `cors({ origin: env.frontendOrigins, credentials: false })` | Only the configured frontend origins may call the API. Auth is by **Bearer token**, not cookies, so `credentials` stays off. |
| 3 | `express.json({ limit: "100kb" })` | Parse JSON bodies; oversized bodies throw a 413 caught later. |
| 4 | `app.use("/businesses", businessRouter)` … | Mount every route group (see 3.3). |
| 5 | `notFoundHandler` | Any unmatched route → `404 { error: "Not found" }`. |
| 6 | `errorHandler` | Central error formatter (see 3.5). |

`env` (from `src/config/env.ts`) is validated **once at startup**. The app
refuses to boot if `JWT_SECRET` is missing/weak, `DATABASE_URL` is empty, or
`FRONTEND_URL` is a localhost value in production. This "fail fast" design means
misconfiguration is caught immediately, not in production at 2am.

### 3.2 The request lifecycle (the single most important idea)

Every API call flows through the same pipeline:

```
HTTP request
   │
   ▼
helmet → cors → json parser
   │
   ▼
Router (e.g. businessRouter)
   ├─ requireAuth            // attach req.user from JWT (or 401)
   ├─ requireRole("...")     // role gate (or 403)
   ├─ validate(schema)       // Zod body/query validation (or 400)
   ├─ requireBusinessOwner   // ownership check (or 403/404)
   ▼
Controller function (businessController.create, …)
   ├─ reads req.body / req.params / req.user
   ├─ talks to Prisma (the DB)
   ├─ maybe calls a lib (notifications, geocode, storage)
   ▼
res.status(...).json(...)   // OR throws → errorHandler
```

Key point for defense: **controllers never trust the client**. The validated
body (`req.body` is replaced by the parsed Zod result) and `req.user.id` (set by
middleware from the JWT) are the only trusted inputs.

### 3.3 Routes → Controllers (the wiring)

Routes live in `src/routes/*.routes.ts`. Each file creates an `Express.Router`
and chains middleware + a controller method. Example
(`src/routes/business.routes.ts`):

```ts
const ownerOnly = [requireAuth, requireRole("BUSINESS_OWNER")];

businessRouter.post("/", ...ownerOnly, validate(createBusinessSchema), businessController.create);
businessRouter.get("/nearby", validateQuery(nearbySearchQuerySchema), businessController.nearby);
businessRouter.get("/:id", businessController.getPublicById);
businessRouter.patch("/:id", ...ownerOnly, requireBusinessOwner("id"), validate(updateBusinessSchema), businessController.update);
```

Notice the **layered guards**: public reads (`getPublicById`, `nearby`) need no
auth; writes need `ownerOnly` and, for existing businesses,
`requireBusinessOwner("id")` which loads the business and compares
`business.ownerId === req.user.id`.

Controllers are exported as **objects**, not individual functions, so imports
stay tidy:
`export const businessController = { create, mine, nearby, getPublicById, update, remove, setHours, getHours };`

### 3.4 Authentication & sessions (`auth.controller.ts`, `auth.middleware.ts`, `utils/jwt.ts`)

- **Signup**: email is lower-cased/trimmed; password hashed with **bcrypt**
  (10 rounds); a JWT is signed and returned with the public user object.
- **Login**: looks up the user, compares the password with bcrypt, signs a JWT.
- **Token shape** (`JwtPayload`): `{ id, role, pwdChangedAt }`.
- **`requireAuth`** verifies the Bearer token, then re-checks the DB:
  - user still exists,
  - not soft-deleted (`deletedAt`),
  - and `pwdChangedAt` in the token is **not older** than the current DB value.
  This last check means **changing/resetting a password instantly kills all
  previously issued tokens** (including leaked ones) — a deliberate security
  feature.
- **`requireRole(...roles)`** is a factory returning a handler that 403s if the
  user's role isn't in the allowed list.
- **Algorithm pinning**: `verifyToken` forces `algorithms: ["HS256"]` to block
  `alg:none` / key-confusion attacks.
- **Timing-equalization**: login/forgot-password run a throwaway bcrypt compare
  for non-existent emails so attackers can't enumerate accounts by response
  time.

### 3.5 Error handling (`error.middleware.ts`, `utils/http-error.ts`)

- Business logic throws `new HttpError(status, message)`. `errorHandler` maps it
  to `res.status(status).json({ error })`.
- `HttpError` is a tiny class: `{ status: number; message: string }`.
- Unknown errors → `500 { error: "Internal server error" }` (and logged).
- `multer` upload errors and oversized JSON (413) are detected by shape and
  returned as clean messages.
- Controllers wrap everything in `try { … } catch (err) { next(err); }` so a
  thrown `HttpError` or a Prisma error always reaches the central handler.

### 3.6 Favorites — anonymous, device-based (`favorite.controller.ts`)

Customers have **no account**. They are identified by a `deviceId` — a UUID
generated client-side and stored in `localStorage` (`device-id.ts`).

- `POST /favorites` with `{ deviceId, businessId }`: only an **APPROVED**
  business can be favourited; duplicate favourites are idempotent (returns 200,
  not an error); concurrent inserts are handled via the unique
  `(deviceId, businessId)` constraint (P2002 → treat as success).
- `DELETE /favorites`, `GET /favorites?deviceId=…`, `GET /favorites/check?…`
  all key off `deviceId`.
- A favourited business that later gets suspended/rejected is silently hidden
  from the list (filtered after fetch), never leaked.

### 3.7 Data model (`prisma/schema.prisma`)

PostgreSQL via **Prisma** (`models/prisma.ts` wraps `PrismaClient` with the
Postgres adapter). Most important tables:

| Table | Role |
|-------|------|
| `User` | owner/admin accounts. Holds `passwordHash`, `passwordChangedAt`, `kycStatus`, profile fields. Soft-delete via `deletedAt`. |
| `KycSubmission` | one per user; NIN stored **encrypted at rest** (AES-256-GCM), masked value precomputed. |
| `Business` | the listing. `status` PENDING/APPROVED/REJECTED/SUSPENDED; `lat/lng` for proximity; `isFeatured` + `featuredUntil` (computed live). |
| `Category` | 12 curated categories. |
| `ServiceItem` | priced services under a business. |
| `Photo` | business images (public R2 bucket). |
| `Favorite` | `(deviceId, businessId)` anonymous saves. |
| `Conversation` / `Message` | anonymous customer (deviceId) ↔ owner chat. |
| `Notification` | inbox rows; delivered in real time via Socket.IO. |
| `AnalyticsEvent` / `OwnerVisit` | anonymous view/contact events. |
| `AuditLog` | immutable admin moderation trail. |

**Relationships** are enforced at the DB level (`onDelete: Cascade`), so
deleting a user removes their businesses, KYC, favorites, conversations, etc.

### 3.8 Cross-cutting libraries (`src/lib/*`)

- **`notifications.ts` + `socket.ts`**: `createNotification()` writes a row
  **and** emits `notification:new` to the user's private Socket.IO room
  (`user:<id>`). Persisting first means a client that reconnects later still sees
  it in the inbox; the socket emit is the fast real-time path.
- **`geocode.ts`**: turns a typed place name into coordinates using
  **OpenStreetMap Nominatim** (no API key),尼日利亚-biased, with an in-memory
  24h cache and a local **gazetteer** fallback (state capitals + Kaduna
  localities) for places OSM hasn't indexed. Exposed at `GET /locations/search`.
- **`rate-limit.ts`**: in-memory sliding-window limiter. Documented limitation:
  single-process only (resets on restart, not shared across instances) — fine
  for the current deployment, flagged for Redis later.
- **`utils/storage.ts`**: multer upload to R2 (public bucket for images, private
  bucket for KYC docs streamed only through authenticated routes).
- **`utils/encryption.ts`**: AES-256-GCM for KYC PII.

### 3.9 Backend naming conventions

- **Folder = concern**: `controllers/`, `routes/`, `middleware/`, `models/`,
  `utils/`, `lib/`, `validation/`, `config/`, `types/`.
- **File names mirror the resource**: `business.controller.ts`,
  `business.routes.ts`, `business.schemas.ts` (validation). This 1:1 mapping
  makes any feature easy to locate.
- **Middleware files are `<thing>.middleware.ts`**; exported guards are
  `requireX` / `validateX` / `createX` (factory) verbs.
- **`*.schemas.ts`** hold Zod schemas; controllers import the *type* only
  (`CreateBusinessInput`) so validation lives in one place.
- Plural resource paths (`/businesses`, `/favorites`) match Prisma model names.

---

## 4. FRONTEND — how it works

### 4.1 Next.js App Router structure

```
src/
├── app/                      # routes = folders; page.tsx = route component
│   ├── layout.tsx           # root layout (html/body, fonts, providers)
│   ├── page.tsx             # "/" → renders <LandingPage/>
│   ├── category/[id]/page.tsx
│   ├── search/page.tsx
│   ├── business/[id]/page.tsx
│   ├── favorites/  owner/  admin/  auth pages …
├── components/              # reusable UI (each a function component)
│   ├── SiteHeader, MarketplaceShell, BusinessCard, LocationPicker, AuthGate …
└── lib/                     # framework-agnostic logic (no JSX)
    ├── api.ts  config.ts  auth.ts  device-id.ts  useCurrentLocation.ts …
```

**Routing rule**: a folder under `app/` becomes a URL segment; `page.tsx` is the
view; `layout.tsx` wraps its subtree (used for the marketplace/owner/admin
shells). Dynamic segments use `[id]` (e.g. `business/[id]`).

### 4.2 Root layout & providers (`app/layout.tsx`)

Sets metadata/viewport, loads fonts, and wraps the whole app in:

- **`<IconSprite/>`** — inline SVG sprite so icons are referenced as
  `<use href="#i-heart"/>` (one HTTP-free icon system).
- **`<AuthGateProvider>`** — React context exposing `guard()` (see 4.6).
- **`<PWAInstall/>`** — install prompt.

### 4.3 The data layer (`lib/`)

This is the frontend's "backend client". All four files below are pure
functions/constants — no React.

**`config.ts`** — `API_BASE_URL` (from `NEXT_PUBLIC_API_BASE_URL` or runtime
override or `localhost:4000`) + `FALLBACK_LOCATION` (Lagos) + `SEARCH_RADIUS_KM`.
`assetUrl()` prefixes relative backend paths with the base URL.

**`api.ts`** — the fetch wrapper. `apiGet/apiPost/apiPatch/apiPut/apiDelete` all
call a shared `apiFetch`. Key behaviours:

- Adds `Authorization: Bearer <token>` from `auth.getToken()`.
- **GET caching** (added recently): responses cached in an in-memory `Map` and
  mirrored to `sessionStorage`, keyed by URL + token, with a **2-minute TTL**.
  A reload or back-navigation reuses the cached response instead of refetching.
- **Invalidation**: any non-GET call clears the GET cache so writes show up
  fresh on the next read.

**`auth.ts`** — session in `localStorage` (`nookly_token`, `nookly_user`).
`saveSession / getToken / getUser / clearSession / signOut`. Includes a
dev-only `ensureSeedFromQuery()` for headless testing (compiled out in prod).

**`device-id.ts`** — `getDeviceId()` returns the persisted anonymous UUID (or
creates one). This is the key that powers device-based favourites/analytics and
matches the backend `Favorite` model.

### 4.4 Hooks (`lib/useCurrentLocation.ts`, `lib/useMediaQuery.ts`)

**`useCurrentLocation()`** — robust, cached geolocation:

- On mount it probes `navigator.permissions`. If already **granted**, it fetches
  coordinates; otherwise it waits for a **user gesture** (a button), because
  mobile browsers silently deny prompts that aren't gesture-initiated.
- The last successful fix is cached in `localStorage` with a **2-minute TTL**; on
  reload/back-navigation the cached coordinates are reused instantly (no
  re-prompt).
- Concurrent `request()` calls are coalesced behind one in-flight promise.
- Returns `{ lat, lng, ready, state, error, request, detectId }`. `detectId`
  increments on every (re)detect so consumers can re-run logic even when the
  coordinates are unchanged (used by the owner business form).
- `state` is one of `unsupported | prompt | granted | denied | locating |
  error`, which the UI uses to show the right message/button.

**`useMediaQuery(query)`** — reactive boolean for responsive logic (e.g.
desktop vs mobile card counts).

### 4.5 How the main screens connect

**Landing page (`LandingPage.tsx` → uses `useCurrentLocation`)**
1. On load it calls the nearby API with the user's coords (or Lagos fallback)
   and shows "Popular in your area".
2. The search box + "Find help" button push to `/search?q=…&loc=…`.
3. The header's login/signup buttons go to `/login` and `/signup` (split on
   mobile).

**Category page (`category/[id]/page.tsx`)** — the richest example:
- Uses `useCurrentLocation()` for GPS.
- `<LocationPicker>` lets the user type a place → `GET /locations/search`
  (backend geocoder) → resolves to coords. A **manually typed place wins** over
  GPS, which wins over a selected city, which wins over Lagos.
- `effective` (a `useMemo`) computes the coordinates actually used.
- `fetchPage()` calls `GET /businesses/nearby?lat&lng&radius&category&page`.
- Infinite scroll via `IntersectionObserver`; open/closed filter + sort are
  applied **client-side** using each business's `hours` (`isOpenNow` in
  `helpers.ts`, timezone-aware).
- Each result renders a `<BusinessCard>`.

**`BusinessCard.tsx`** — shows cover, name, distance, open/closed, and two
action buttons:
- **Heart (favourite)**: calls `toggleFavorite(id)` → `POST/DELETE /favorites`
  with `deviceId`. Turns **red** when `isFav` is true (the styling change we
  made). No login required.
- **Message**: calls `authGate.guard()`; if not logged in, the `AuthGate`
  prompt opens; otherwise `MessageOwnerModal` opens.

**`MarketplaceShell.tsx`** — the shared "workspace" chrome (header + sidebar)
for dashboard/favorites/messages/profile. On mount it refreshes the cached user
via `GET /auth/me` so the display name is current. `active` prop highlights the
current nav item.

**`SiteHeader.tsx`** — public-site header; login/signup split into separate
links on mobile.

### 4.6 Auth gating on the client (`AuthGate.tsx`)

`AuthGateProvider` provides `guard()`. Components call `guard()` before a
gated action (e.g. opening the message modal). If the user is logged in it
returns `true`; otherwise it opens a modal prompting login/signup and returns
`false`. **Favouriting is intentionally NOT gated** (device-based), but messaging
is — this is the "allow without login" decision from earlier work.

### 4.7 End-to-end favorite flow (a clean example to recite)

1. User taps the heart on a `BusinessCard`.
2. `toggleFavorite(businessId)` reads `getDeviceId()` (creates one if absent)
   and calls `POST /favorites` (cached GET cleared by the write).
3. Backend `favoriteController.add` verifies the business is APPROVED, then
   `prisma.favorite.create({ deviceId, businessId })`.
4. UI flips `isFav` → heart turns red; the `/favorites` page later lists them by
   the same `deviceId`.
5. No account, no token — just the device UUID in `localStorage`.

### 4.8 Frontend naming conventions

- **`components/`**: one component per file, PascalCase, named after its role
  (`SiteHeader`, `BusinessCard`, `LocationPicker`). Files with multiple exports
  are rare.
- **`lib/`**: camelCase, purpose-named (`api`, `auth`, `config`,
  `useCurrentLocation`). Hooks are `useX`; pure helpers are `formatNaira`,
  `isOpenNow`, `imageUrl`, etc.
- **`app/`**: folder = route; `page.tsx` = view, `layout.tsx` = wrapper,
  `loading.tsx`/`error.tsx` = states. Dynamic routes use `[param]`.
- **Types** are centralized in `lib/types.ts` (one interface per payload) so
  the frontend and backend contracts stay in sync by convention.
- **"Container" vs "presentational"**: pages hold state/effects; components
  receive props and stay dumb. `BusinessCard` is presentational; `CategoryPage`
  is the container.

---

## 5. How frontend and backend connect

- **Transport**: plain `fetch` → REST JSON. Base URL from `config.API_BASE_URL`.
- **Auth**: JWT in the `Authorization: Bearer <token>` header (not cookies).
- **CORS**: backend allows only `env.frontendOrigins`; frontend never sends
  cookies, so `credentials: false` on both sides.
- **Errors**: backend returns `{ error }` (and `{ fields }` for validation);
  `apiFetch` throws `ApiError` with `.status` so the UI can branch (e.g. 401 →
  redirect to `/login`).
- **Realtime**: a separate Socket.IO connection (same origin rules) delivers
  `notification:new` to `user:<id>` rooms; the frontend `NotificationBell`
  listens and the inbox reads the persisted rows.
- **Assets**: uploaded images are served from the R2 public bucket; backend
  returns relative URLs that `assetUrl()`/`imageUrl()` prefix with the API base.

---

## 6. Recent changes worth mentioning in a defense

- **Red favourite state**: `BusinessCard` heart and `BusinessActions` "Save"
  button now turn red (`fill-red-500` / `text-red-500`) when favourited.
- **Local caching**: `api.ts` GET cache (2-min TTL, memory + `sessionStorage`)
  and `useCurrentLocation` localStorage cache (2-min TTL) mean reloads and
  back-navigation don't refetch — both expire and refetch after 2 minutes.
- **Mobile geolocation hardening**: permission probe + user-gesture request +
  coalesced promise + cache reuse.
- **Real name-based location**: backend `/locations/search` (Nominatim +
  gazetteer) powering `LocationPicker`, so even small Kaduna localities resolve.

---

## 7. Defense Q&A (likely questions → short answers)

**Q: How do you secure authentication?**
A: JWT in the Bearer header, HS256 pinned; tokens carry `pwdChangedAt` so a
password change invalidates all older tokens; soft-deleted accounts are
rejected; bcrypt (10 rounds) for passwords; timing-equalization prevents
account enumeration.

**Q: How can customers favourite without an account?**
A: They're identified by an anonymous `deviceId` UUID in `localStorage`; the
backend `Favorite` table is keyed on `(deviceId, businessId)`.

**Q: Why is location handled with a "Use my location" button?**
A: Mobile browsers only show the permission prompt from a user gesture; a
load-time `getCurrentPosition()` is silently denied. We probe permission, then
require a tap. Results are cached 2 minutes so reloads don't re-prompt.

**Q: How do the frontend and backend talk?**
A: REST JSON over `fetch`. The frontend prefixes calls with `API_BASE_URL`,
adds the JWT header, and CORS restricts calls to the known frontend origin.

**Q: How is moderation modelled?**
A: A business `status` is PENDING/APPROVED/REJECTED/SUSPENDED. A KYC-verified
owner's new business goes APPROVED automatically; unverified owners stay
PENDING for human review. Every admin action writes an immutable `AuditLog`.

**Q: How are KYC documents protected?**
A: NIN is encrypted at rest (AES-256-GCM) and only a masked value is ever
returned; documents live in a private bucket and are streamed only through
authenticated routes.

**Q: Is the code organised consistently?**
A: Yes — backend splits `routes/controllers/middleware/validation/utils/lib`;
frontend splits `app/` (routes) / `components/` (UI) / `lib/` (logic). Files are
named after the resource they serve, making any feature easy to find.

**Q: What are the known limitations?**
A: The rate limiter is in-memory (single instance); geocoding is external
(Nominatim) with a gazetteer fallback; nearby search uses lat/lng columns (no
PostGIS yet, planned). All are documented in-code.

---

*Generated as a study/defense aid. File paths reference the current repo state
on the `master` branch.*
