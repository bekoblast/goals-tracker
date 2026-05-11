# Docker Hub Guide

Docker image:

```text
bekoblast/goals-tracker:latest
```

## What This Image Runs

This image runs the full Team Goals Tracker app in one container:

- Arabic RTL React SPA
- Express API
- In-app notifications
- Role-based goal tracking
- Backup, restore, reset, and audit log
- JSON data persistence through `/app/data`

## Quick Run

```bash
docker run -d \
  --name goals-tracker \
  -p 4174:4174 \
  -v goals-tracker-data:/app/data \
  bekoblast/goals-tracker:latest
```

Open:

```text
http://localhost:4174
```

Health check:

```bash
curl http://localhost:4174/api/health
```

Expected response:

```json
{ "ok": true }
```

## Docker Compose

```yaml
services:
  goals-tracker:
    image: bekoblast/goals-tracker:latest
    container_name: goals-tracker
    restart: unless-stopped
    ports:
      - "4174:4174"
    volumes:
      - goals-tracker-data:/app/data

volumes:
  goals-tracker-data:
```

Run:

```bash
docker compose up -d
```

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | Runtime mode |
| `HOST` | `0.0.0.0` | Bind address inside the container |
| `PORT` | `4174` | App port inside the container |

## Default Demo Users

```text
Super Admin: admin / 0000
Manager: manager / 1111
Employee: amina / 2222
```

Change demo PINs before using the app with real team data.

## Data Persistence

The app stores runtime data at:

```text
/app/data/goals.json
```

Always mount `/app/data` to a Docker volume or host directory so users, goals, sessions, notifications, and backups survive container replacement.

## Logs

```bash
docker logs -f goals-tracker
```

## Stop And Remove

```bash
docker rm -f goals-tracker
```

The named volume remains unless you remove it manually.

## Source Code

GitHub:

```text
https://github.com/bekoblast/goals-tracker
```
