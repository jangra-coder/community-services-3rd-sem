# ---- build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build -w client && npm prune --omit=dev

# ---- runtime stage ---------------------------------------------------------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    SERVE_CLIENT=true

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

USER node
EXPOSE 4000
CMD ["node", "server/src/index.js"]
