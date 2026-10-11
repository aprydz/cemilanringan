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
5. Start the API with `npm run dev:api` and the storefront with `npm run dev:web`.

The storefront runs at `http://localhost:5173`; the API runs at `http://localhost:3000`. Start Docker Desktop before `docker compose up -d mysql`. The seed data is development-only.

Validate and generate the Prisma client with `npm run db:validate` and `npm run db:generate`.
Run the API boundary suite with `npm run test:api` and all workspace production builds with `npm run build`.

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