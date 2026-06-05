# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps (need dev deps to compile TS)
COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/main.js"]
