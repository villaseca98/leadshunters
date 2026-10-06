# ---- dependencias ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- producción ----
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts
COPY --from=deps /app/node_modules/bcryptjs ./node_modules/bcryptjs
USER app
EXPOSE 3000
# aplica migraciones pendientes, crea el admin si hay ADMIN_PASSWORD y arranca
# (en Render, APP_URL toma la URL pública del servicio si no la defines)
CMD ["sh", "-c", "export APP_URL=${APP_URL:-$RENDER_EXTERNAL_URL}; node scripts/migrate.mjs && if [ -n \"$ADMIN_PASSWORD\" ]; then node scripts/seed.mjs; fi && node server.js"]
