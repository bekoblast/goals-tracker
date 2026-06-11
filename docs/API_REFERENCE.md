# API Reference

Base URL in development:

```text
http://127.0.0.1:4174
```

In production, the API is served from the same host and port as the SPA.

## Authentication

Protected routes require:

```text
Authorization: Bearer <token>
```

## Health

### `GET /api/health`

Returns service health.

```json
{ "ok": true }
```

## Auth

### `POST /api/login`

Body:

```json
{
  "userId": "manager",
  "pin": "1111",
  "remember": true
}
```

Returns the public user, token, and expiry date.

### `POST /api/logout`

Requires authentication. Removes the current session.

## Bootstrap

### `GET /api/bootstrap`

Requires authentication. Returns the data needed to render the current user's workspace.

Managers and Super Admins receive all goals. Employees receive only their own goals.

## Notifications

### `GET /api/notifications`

Returns notifications for the current user.

### `PATCH /api/notifications/:id/read`

Marks one notification as read.

### `POST /api/notifications/read-all`

Marks all notifications for the current user as read.

## Users

Super Admin only.

### `POST /api/employees`

Creates a user.

Body:

```json
{
  "name": "New User",
  "id": "new-user",
  "pin": "7777",
  "role": "employee"
}
```

### `PATCH /api/employees/:id`

Updates role, active status, name, or PIN.

Body examples:

```json
{ "role": "manager" }
```

```json
{ "active": false }
```

## Goals

Manager or Super Admin for creation and deletion. Employees can update only their assigned goals.

### `POST /api/goals`

Creates a goal.

```json
{
  "title": "Quarterly report",
  "owner": "Amina",
  "dueDate": "2026-06-01",
  "progress": 0,
  "description": "Prepare and submit the report."
}
```

### `PATCH /api/goals/:id`

Updates goal fields, progress, or status.

### `DELETE /api/goals/:id`

Deletes a goal.

## Activities

### `POST /api/goals/:id/activities`

Adds an activity to a goal.

```json
{
  "text": "Finished data collection."
}
```

## Iqama Records

Manager or Super Admin only. Employees do not receive Iqama data in bootstrap responses.

### `GET /api/iqama`

Returns all Iqama records.

### `POST /api/iqama`

Creates an Iqama record linked to an active employee.

```json
{
  "employeeId": "amina",
  "iqamaNumber": "1234567890",
  "nationality": "Saudi",
  "jobTitle": "Operations Coordinator",
  "issueDate": "2025-07-01",
  "expiryDate": "2026-07-15",
  "notes": "Renewal preparation started."
}
```

### `PATCH /api/iqama/:id`

Updates Iqama details and can generate an expiry notification when the record expires within 90 days.

### `POST /api/iqama/:id/renewals`

Records a renewal with the previous expiry date, new expiry date, note, author, and timestamp.

```json
{
  "newExpiryDate": "2027-07-15",
  "note": "Renewed for one year."
}
```

### `DELETE /api/iqama/:id`

Deletes an Iqama record.

## Settings

### `PATCH /api/settings/iqama-alerts`

Super Admin only. Configures the shared Iqama expiry alert thresholds.

```json
{
  "iqamaAlertDays": [90, 60, 30, 7]
}
```

## Admin Data

Super Admin only.

### `GET /api/backup`

Downloads the current JSON data.

### `POST /api/restore`

Restores app data from a valid backup JSON body.

### `POST /api/reset`

Initializes the app back to seed data.
