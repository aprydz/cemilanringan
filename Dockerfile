# Railway / production — single service (API + Web static)
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps via npm workspaces (root)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci

# Copy source
COPY . .

# Prisma client needs DATABASE_URL at generate time — dummy is enough for build
ENV DATABASE_URL="mysql://user:pass@localhost:3306/dummy"
RUN npx --workspace @piscokshop/api prisma generate

# Vite build is baked at image build time. Leave empty to have frontend call same-origin /api
# Set VITE_API_URL di Railway > Variables jika API beda domain dari Web.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Runner — hanya yang dibutuh runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy build artifacts + prisma schema + node_modules (Prisma client ada di root node_modules)
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Railway inject PORT otomatis. migrate deploy idempotent, lalu start API (yang juga serve Web static)
CMD ["sh", "-c", "npx --workspace @piscokshop/api prisma migrate deploy && node apps/api/dist/server.js"]
