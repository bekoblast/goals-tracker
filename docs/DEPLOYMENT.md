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

## Windows Docker Installation

For local testing on Windows, install Docker Desktop:

1. Download Docker Desktop from the official Docker website.
2. Install it with the WSL 2 backend enabled.
3. Start Docker Desktop.
4. Wait until the engine is running.

Verify installation from PowerShell:

```powershell
docker --version
docker compose version
docker info
```

If `docker info` returns server details, Docker is ready.

## Build The Docker Image

From the project folder:

```bash
docker build -t goals-tracker:latest .
```

Expected result:

```text
goals-tracker:latest
```

List the image:

```bash
docker images goals-tracker
```

## Deploy With Docker Compose

From the project folder:

```bash
docker compose up -d --build
```

Open:

```text
http://SERVER_IP:4174
```

On your local Windows machine, use:

```text
http://127.0.0.1:4174
```

## Verify The Running App

Check containers:

```bash
docker compose ps
```

Check logs:

```bash
docker compose logs -f
```

Check the health endpoint:

```bash
curl http://127.0.0.1:4174/api/health
```

Expected response:

```json
{ "ok": true }
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

## Run Without Compose

For a quick manual container run:

```bash
docker run -d --name goals-tracker -p 4174:4174 -v "%cd%/data:/app/data" goals-tracker:latest
```

PowerShell version:

```powershell
docker run -d --name goals-tracker -p 4174:4174 -v "${PWD}\data:/app/data" goals-tracker:latest
```

Stop and remove it:

```bash
docker rm -f goals-tracker
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

## Troubleshooting

### Docker command works but build fails to connect to engine

Make sure Docker Desktop is open and the Linux engine is running. Then retry:

```bash
docker info
```

### Port 4174 is already in use

Change the published port in `docker-compose.yml`:

```yaml
ports:
  - "8080:4174"
```

Then open:

```text
http://127.0.0.1:8080
```

### Data does not persist

Confirm the volume exists:

```yaml
volumes:
  - ./data:/app/data
```

After first login, `data/goals.json` should exist on the host machine.

### Container starts but app does not open

Check logs:

```bash
docker compose logs -f
```

Check health:

```bash
curl http://127.0.0.1:4174/api/health
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
