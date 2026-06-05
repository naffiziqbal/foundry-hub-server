# Foundry-Hub · Server (NestJS)

REST API for the Foundry-Hub platform.

## Stack

- **NestJS 10** · TypeScript
- **TypeORM** + **PostgreSQL**
- **BullMQ** + **Redis** (async product-import worker, rate limiting, cache)
- **Passport JWT** auth + role-based guards (designer / client)
- **DigitalOcean Spaces** (S3-compatible) for all file storage
- **pdfkit** for schedule PDF exports
- **cheerio** for vendor URL scraping (JSON-LD → OpenGraph → HTML fallback)
- **Swagger** at `/api/docs`

## Run

This backend is fully standalone — its `docker-compose.yml` includes Postgres
and Redis, so one command brings up the whole API stack:

```bash
cp .env.example .env        # add your DigitalOcean Spaces keys
docker compose up -d --build   # API + Postgres + Redis → http://localhost:4000/api
```

### Local development (hot reload)

Run just the infra in Docker and the API on your host:

```bash
cp .env.example .env        # DATABASE_HOST=localhost, DATABASE_PORT=5434, REDIS_PORT=6380
docker compose -f docker-compose.dev.yml up -d   # Postgres + Redis only
npm install
npm run start:dev           # http://localhost:4000/api
```

The schema is created automatically (`DB_SYNC=true`). A demo designer + client
and a sample project are seeded on first boot (`SEED_ON_BOOT=true`).

## Module map

| Module          | Responsibility                                                    |
| --------------- | ----------------------------------------------------------------- |
| `auth`          | register / login / JWT / password reset                           |
| `users`         | profile, client lookup for assignment                             |
| `projects`      | project CRUD, client assignment, **central access guard**         |
| `rooms`         | per-project rooms, ordering                                       |
| `products`      | product CRUD, URL import, move/reorder, **approval workflow**      |
| `schedules`     | material/furniture/fixture schedules, items, drag-order, PDF export |
| `comments`      | per-product internal + client-visible comments                   |
| `notifications` | in-app feed + email hooks                                         |
| `import`        | BullMQ queue + worker + scraper                                   |
| `dashboard`     | aggregate stats for the home view                                 |
| `storage`       | Spaces uploads (`POST /api/files/upload`)                         |
| `redis`/`mail`  | shared infra providers                                            |

## Key endpoints

```
POST   /api/auth/register | /login | /forgot-password | /reset-password
GET    /api/auth/me
GET    /api/dashboard/summary
GET    /api/projects                         POST /api/projects
GET    /api/projects/:id                      PATCH/DELETE /api/projects/:id
PATCH  /api/projects/:id/client               (assign client)
GET/POST  /api/projects/:projectId/rooms      PATCH/DELETE /api/rooms/:id
GET/POST  /api/rooms/:roomId/products
POST   /api/rooms/:roomId/products/import     (URL → BullMQ scrape)
PATCH/DELETE /api/products/:id                PATCH /api/products/:id/move
POST   /api/products/:id/request-approval     POST /api/products/:id/decision
GET/POST  /api/products/:productId/comments
GET/POST  /api/projects/:projectId/schedules
POST   /api/schedules/:id/items               PATCH /api/schedule-items/:itemId
POST   /api/schedules/:id/export              (→ PDF on Spaces)
GET    /api/notifications  ·  POST /api/files/upload
```

All routes require `Authorization: Bearer <jwt>` except auth + health.
Mutating project/room/product/schedule routes are **designer-only**; clients
get read access plus the approval decision + client-visible comments.
