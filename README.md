# Piscokshop

E-commerce for Indonesian snacks, organized as an npm-workspaces monorepo.

## Requirements

- Node.js 20.14 or newer in the Node 20 line
- npm 10 or newer
- MySQL 8 for database-backed features

## Development

1. Install dependencies from the repository root with `npm install`.
2. Start local MySQL with `docker compose up -d mysql` (Docker Desktop required).
3. Copy `apps/api/.env.example` to `apps/api/.env`. Its local database URL matches the development-only Compose credentials.
4. Apply the schema with `npm run db:migrate`, then load starter products with `npm run db:seed`.
5. Start both servers together with `npm run dev` (or individually with `npm run dev:api` and `npm run dev:web`).

The storefront runs at `http://localhost:5173`; the API runs at `http://localhost:3000`. Start Docker Desktop before `docker compose up -d mysql`. The seed data is development-only.

Validate and generate the Prisma client with `npm run db:validate` and `npm run db:generate`.
Run the API boundary suite with `npm run test:api`, type checking with `npm run typecheck`, and production builds with `npm run build`.

## Deploy ke Railway via GitHub

Project ini sudah **Railway-ready** sebagai **single service** (API serve frontend static + auto `prisma migrate deploy` saat start).

**Sudah disiapkan di repo:**
- `Dockerfile` (multi-stage, build web + api, runner `prisma migrate deploy && node dist/server.js`)
- `railway.json` (builder `dockerfile`, healthcheck `GET /api/health`)
- `nixpacks.toml` (fallback bila Railway pakai Nixpacks, bukan Docker)
- `apps/api/src/app.ts` serve `apps/web/dist` + SPA fallback (di luar `/api`)
- `apps/web/src/lib/api.ts` fallback `VITE_API_URL` → `/api` saat di Railway (same-origin)

**Langkah deploy:**
1. **MySQL di Railway dulu:** Railway → New Project → **Add MySQL** (plugin). Copy `DATABASE_URL`-nya (format `mysql://...`).
2. **Service Web+API:** New Service → **Deploy from GitHub repo** → pilih `aprydz/cemilanringan` → branch `main` → Railway auto-detect `Dockerfile`.
3. **Variables (Service → Variables):**
   - `DATABASE_URL` = dari MySQL plugin (atau manual MySQL eksternal)
   - `JWT_ACCESS_SECRET` = random 32+ char (wajib di production, mis. `openssl rand -base64 32`)
   - `CLIENT_ORIGIN` = URL frontend (jika single service, isi URL Railway itu sendiri, mis. `https://<app>.up.railway.app`; jika split service, boleh `https://web-xyz.up.railway.app,https://web-preview...` comma-separated)
   - `SHIPPING_FLAT_RATE_IDR` = mis. `15000`
   - `PAYMENT_SERVER_KEY` + `PAYMENT_API_BASE_URL` (kosongkan dulu jika belum pakai Midtrans; isi saat butuh — di production validasi butuh non-sandbox URL)
   - `PORT` **jangan diisi manual** (Railway inject otomatis)
   - `VITE_API_URL` → **kosongkan** jika pakai single service (frontend akan hit `/api` same-origin). Isi `https://<api>.up.railway.app/api` hanya jika API dan Web dipisah jadi 2 service.
   - `INITIAL_ADMIN_NAME` / `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` → hanya untuk **sekali** buat admin pertama (lihat di bawah).
4. **Deploy** → cek **Deployments → View Logs** → harus `Piscokshop API listening on port ...` dan `Prisma migrate deploy` sukses.
5. **Buat admin pertama (sekali):** Railway → Service → **Variables** isi 3 `INITIAL_ADMIN_*` → **Deploy** ulang lalu **Run Command** / **Shell**: `npm run admin:create --workspace @piscokshop/api` (atau `npx --workspace @piscokshop/api tsx prisma/create-admin.ts`). Setelah sukses, **hapus** 3 var itu dan redeploy.
6. **Healthcheck:** `GET https://<app>.up.railway.app/api/health` harus `200`.
7. **Update `CLIENT_ORIGIN` & `PAYMENT_*` production** setelah domain final fix (env `production` akan reject `localhost` + sandbox Midtrans).

**Opsi split 2 service** (jika mau Web di-host terpisah, mis. Vercel): build Web dengan `VITE_API_URL=https://<api>.up.railway.app/api`, API tetap single service. `CLIENT_ORIGIN` di API isi origin Web tersebut. Dockerfile tetap bisa dipakai untuk service API saja (Web dist tetap dibuild tapi tidak diserve bila `VITE_API_URL` eksternal — tidak masalah).

The Compose credentials are only for local development and must not be reused in production. The initial migration is generated but must be applied to the local database before catalog and authentication operations will work.

## Authentication API

- `POST /api/auth/register` creates a customer account; client-supplied roles are rejected.
- `POST /api/auth/login` returns a short-lived access token and sets an HttpOnly refresh cookie.
- `POST /api/auth/refresh` rotates the refresh cookie and returns a new access token.
- `POST /api/auth/logout` revokes the current refresh session.
- `GET /api/auth/me` requires `Authorization: Bearer <access-token>`.

The refresh cookie is restricted to `/api/auth`, uses `SameSite=Strict`, and is `Secure` in production. Configure `JWT_ACCESS_SECRET` to a random value of at least 32 characters before production deployment. Customer registration cannot create admin accounts. Provision the first admin explicitly with `npm run admin:create` and the temporary `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` environment variables; existing accounts are never promoted or modified by this command.

## Checkout and payments

- `POST /api/shipping/quotes` returns the configured local flat-rate quote; a provider adapter can replace it later.
- `POST /api/orders` recalculates product prices, coupon discounts, shipping, and totals; it snapshots the address/items and reserves stock transactionally.
- Pending orders expire after 30 minutes; the API worker releases stock and coupon reservations.
- `POST /api/payments/create` requires an `Idempotency-Key` header and returns a Midtrans Snap checkout URL.
- `POST /api/payments/webhook` verifies the Midtrans signature and amount before updating payment/order state.

Set `PAYMENT_SERVER_KEY` in `apps/api/.env` to enable payment creation. Local defaults use the Midtrans sandbox URL; configure production credentials and a non-sandbox URL for deployment. Payment state is never accepted from the browser.

Active product promotions are automatically applied as the single best offer per product; campaigns do not stack. Promotion prices are reflected in product cards, product detail, cart, coupon minimum-spend checks, checkout, and immutable order-item snapshots. Coupons apply after product promotions.