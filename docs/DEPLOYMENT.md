# Deployment Guide

This app is designed to deploy as one Docker container:

- Express serves `/api`.
- Express serves the built React SPA from `dist/`.
- Runtime data is stored in `/app/data/goals.json`.
- Docker Compose mounts `./data` from the server to `/app/data` in the container.

## VPS Requirements

- Docker
- Docker Compose
- One available TCP port, default `4174`

## Deploy With Docker Compose

From the project folder:

```bash
docker compose up -d --build
```

Open:

```text
http://SERVER_IP:4174
```

## Check Logs

```bash
docker compose logs -f
```

## Restart

```bash
docker compose restart
```

## Stop

```bash
docker compose down
```

## Data Persistence

The compose file includes:

```yaml
volumes:
  - ./data:/app/data
```

This keeps app data on the VPS filesystem even if the container is rebuilt.

## Backup Strategy

Use the Super Admin backup button from the app before major updates.

You can also copy the data file directly on the VPS:

```bash
cp data/goals.json data/goals.backup.$(date +%F).json
```

## Updating The App

Pull the latest code, then rebuild:

```bash
git pull
docker compose up -d --build
```

## Reverse Proxy Notes

If using Nginx, proxy to:

```text
http://127.0.0.1:4174
```

Make sure these headers are passed:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

## Security Checklist

- Change demo PINs after first login.
- Create a real Super Admin account.
- Disable demo users if not needed.
- Keep `data/goals.json` out of Git.
- Put the app behind HTTPS when exposed publicly.
- Take regular backups from the Super Admin screen.
