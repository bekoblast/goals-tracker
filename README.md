# Team Goals Tracker

A friendly Arabic RTL single-page app for managing team goals, tracking employee activities, and monitoring completion progress.

The app is designed for small teams that need a simple manager/employee workflow without the weight of a large project management platform. It includes role-based access, in-app notifications, user guides, backups, restore, audit logging, and Docker deployment support.

## Highlights

- Arabic RTL interface with role-specific experiences.
- Super Admin role for users, roles, reset, backup, restore, and audit log.
- Manager role for goal creation, assignment, updates, reports, and exports.
- Employee role for progress updates and activity logs.
- In-app notifications with unread badge, read state, and mark-all-read.
- Secure PIN login with hashed PINs and bearer sessions.
- Persistent JSON storage for lightweight deployment.
- Single-container production deployment with Docker Compose.

## Tech Stack

- React 19
- TypeScript
- Vite
- Express
- bcryptjs
- lucide-react
- Docker

## Quick Start

```bash
npm install
npm run dev
```

Web app: `http://127.0.0.1:5175`

API: `http://127.0.0.1:4174`

## Demo Users

```text
Super Admin: admin / 0000
Manager: manager / 1111
Employee: amina / 2222
```

Change demo users and PINs before using the app with real team data.

## Production

```bash
npm install
npm run build
NODE_ENV=production HOST=0.0.0.0 PORT=4174 npm start
```

In production, Express serves both the compiled SPA and `/api` from one port.

## Docker

### Build The Image

```bash
docker build -t goals-tracker:latest .
```

### Run With Docker Compose

```bash
docker compose up -d --build
```

Open:

```text
http://127.0.0.1:4174
```

On a VPS, replace `127.0.0.1` with the server IP or domain.

The `docker-compose.yml` file mounts `./data` to `/app/data`, so app data survives rebuilds and restarts.

### Verify The Container

```bash
docker compose ps
docker compose logs -f
```

Health endpoint:

```text
http://127.0.0.1:4174/api/health
```

Expected response:

```json
{ "ok": true }
```

### Stop The Container

```bash
docker compose down
```

## Documentation

- [Developer Guide](docs/DEVELOPER_GUIDE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Docker Hub Guide](docs/DOCKER_HUB.md)
- [Portfolio Case Study](docs/PORTFOLIO_CASE_STUDY.md)

## Scripts

```bash
npm run dev        # Run web and API in development
npm run dev:web    # Run Vite only
npm run dev:api    # Run Express API only
npm run build      # Type-check and build frontend
npm run lint       # Run ESLint
npm start          # Run production Express server
```

## Data Storage

Runtime data is stored in `data/goals.json`. The file is intentionally ignored by Git because it may contain sessions, users, audit entries, and team data.

When the file does not exist, the app creates it from the seed data in `server/seed.ts`.
