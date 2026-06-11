# Developer Guide

## Project Structure

```text
team-goals-tracker/
  src/                  React SPA
  server/               Express API and JSON data store
  public/               Static assets, including the app logo
  data/                 Runtime data folder, ignored by Git except .gitkeep
  docs/                 Developer and portfolio documentation
  Dockerfile            Production image definition
  docker-compose.yml    VPS-friendly deployment file
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the frontend and backend together:

```bash
npm run dev
```

Development URLs:

```text
Web: http://127.0.0.1:5175
API: http://127.0.0.1:4174
```

Vite proxies `/api` to the Express API in development.

## Production Mode

Build the SPA:

```bash
npm run build
```

Run one Express process that serves both the SPA and API:

```bash
NODE_ENV=production HOST=0.0.0.0 PORT=4174 npm start
```

## Docker Development Check

Build the Docker image locally:

```bash
docker build -t goals-tracker:latest .
```

Run the container with Docker Compose:

```bash
docker compose up -d --build
```

Open:

```text
http://127.0.0.1:4174
```

Check the API:

```text
http://127.0.0.1:4174/api/health
```

Expected response:

```json
{ "ok": true }
```

Stop the container:

```bash
docker compose down
```

## Important Concepts

### Roles

The app has three roles:

- `super_admin`: manages users, roles, backup, restore, reset, and audit log.
- `manager`: creates and manages goals, views reports, and tracks team progress.
- `employee`: sees assigned goals, updates progress, and logs activities.

### Authentication

Users log in with an ID and PIN. PINs are stored as bcrypt hashes. Successful login creates a bearer session token stored in `data/goals.json`.

The frontend sends:

```text
Authorization: Bearer <token>
```

### Persistence

The app uses a JSON file store at:

```text
data/goals.json
```

This is intentionally simple and easy to deploy for small teams. If the app grows, the storage layer can be migrated to SQLite or PostgreSQL while keeping most API routes intact.

### Notifications

Notifications are in-app only. They are generated for events such as:

- New goal assignment
- Goal updates
- At-risk goals
- Deleted goals
- New activities
- User and role changes
- Backup, restore, and reset actions

Each notification has read/unread state and belongs to one user.

### Employee Operations Hub

The first screen after login is a shared dashboard that summarizes active employees, goals, alerts, and recent activities. Managers and Super Admins can switch between the Goals and Iqama modules.

### Iqama Records

Iqama records are stored in `iqamaRecords` and linked to employees by `employeeId`. Only Managers and Super Admins receive or manage these records.

The module calculates three expiry states:

- `valid`: more than 90 days remaining
- `expiring`: 0 to 90 days remaining
- `expired`: expiry date is in the past

Creating or updating a near-expiry record generates an in-app notification for other Managers and Super Admins.

## Quality Checks

Run before pushing:

```bash
npm run lint
npm run build
```

## Development Notes

- Keep UI text Arabic because the product is Arabic-first.
- Keep developer documentation in English.
- Do not commit `data/goals.json`; it may contain sessions and real team data.
- Keep Docker deployment simple: one container, one port, persistent `data/` volume.
