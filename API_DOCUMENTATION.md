# Uptime Kuma REST API v2 Documentation

## Overview

The Uptime Kuma API v2 provides a RESTful interface for managing monitors, status pages, tags, and maintenance windows. All endpoints require authentication.

## Base URL

```
http://localhost:3001/api/v2
```

## Authentication

The API uses Basic Authentication with either username/password or API keys.

### Using Username/Password

```bash
curl -u username:password http://localhost:3001/api/v2/monitors
```

### Using API Keys

First, generate an API key through the Uptime Kuma UI, then use it as the password with any username:

```bash
curl -u anyuser:uk1_YOUR_API_KEY http://localhost:3001/api/v2/monitors
```

## Endpoints

### Monitors

#### List All Monitors
```http
GET /api/v2/monitors
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "My Website",
    "url": "https://example.com",
    "type": "http",
    "interval": 60,
    "active": 1,
    "latestHeartbeat": {
      "status": 1,
      "time": "2024-01-10T12:00:00Z",
      "msg": "OK",
      "ping": 123
    }
  }
]
```

#### Get Monitor by ID
```http
GET /api/v2/monitors/:id
```

**Response:**
```json
{
  "id": 1,
  "name": "My Website",
  "url": "https://example.com",
  "type": "http",
  "method": "GET",
  "interval": 60,
  "retryInterval": 60,
  "maxretries": 0,
  "active": 1,
  "latestHeartbeat": {
    "status": 1,
    "time": "2024-01-10T12:00:00Z",
    "msg": "OK",
    "ping": 123
  }
}
```

#### Create Monitor
```http
POST /api/v2/monitors
```

**Request Body:**
```json
{
  "name": "New Monitor",
  "type": "http",
  "url": "https://example.com",
  "method": "GET",
  "interval": 60,
  "retryInterval": 60,
  "maxretries": 3,
  "accepted_statuscodes": ["200-299"],
  "headers": {
    "User-Agent": "Uptime-Kuma"
  }
}
```

**Monitor Types:**
- `http` - HTTP(S) 
- `tcp` - TCP Port
- `ping` - Ping
- `keyword` - HTTP(S) with keyword check
- `json-query` - HTTP(S) with JSON query
- `dns` - DNS
- `push` - Push (Passive monitoring)
- `steam` - Steam Game Server
- `gamedig` - GameDig
- `mqtt` - MQTT
- `redis` - Redis
- `postgres` - PostgreSQL
- `mysql` - MySQL/MariaDB
- `mongodb` - MongoDB
- `radius` - Radius
- `sqlserver` - Microsoft SQL Server

#### Update Monitor
```http
PUT /api/v2/monitors/:id
```

**Request Body:** Same as create, but only include fields to update

#### Delete Monitor
```http
DELETE /api/v2/monitors/:id
```

#### Pause Monitor
```http
POST /api/v2/monitors/:id/pause
```

#### Resume Monitor
```http
POST /api/v2/monitors/:id/resume
```

#### Get Monitor Heartbeats
```http
GET /api/v2/monitors/:id/heartbeats?limit=100&offset=0
```

**Response:**
```json
[
  {
    "id": 1234,
    "status": 1,
    "time": "2024-01-10T12:00:00Z",
    "msg": "OK",
    "ping": 123,
    "monitor_id": 1
  }
]
```

### Status Pages

#### List Status Pages
```http
GET /api/v2/status-pages
```

#### Get Status Page
```http
GET /api/v2/status-pages/:slug
```

#### Create Status Page
```http
POST /api/v2/status-pages
```

**Request Body:**
```json
{
  "slug": "my-status",
  "title": "My Status Page",
  "description": "Service Status",
  "theme": "light",
  "published": true,
  "showTags": false,
  "customCSS": "",
  "footerText": "",
  "showPoweredBy": true
}
```

### Tags

#### List Tags
```http
GET /api/v2/tags
```

#### Create Tag
```http
POST /api/v2/tags
```

**Request Body:**
```json
{
  "name": "Production",
  "color": "#ff0000"
}
```

### Maintenance

#### List Maintenance Windows
```http
GET /api/v2/maintenance
```

#### Create Maintenance Window
```http
POST /api/v2/maintenance
```

**Request Body:**
```json
{
  "title": "Scheduled Maintenance",
  "description": "System upgrade",
  "start_date": "2024-01-10T00:00:00Z",
  "end_date": "2024-01-10T02:00:00Z",
  "monitors": [1, 2, 3]
}
```

### System

#### Get System Info
```http
GET /api/v2/info
```

**Response:**
```json
{
  "version": "2.0.0-beta.3",
  "latestVersion": "2.0.0-beta.3",
  "monitorCount": 15,
  "uptimeData": {
    "totalUp": 99.5,
    "totalDown": 0.5
  },
  "serverTimezone": "UTC",
  "serverTime": "2024-01-10T12:00:00Z"
}
```

## Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## Error Response Format

```json
{
  "error": "Error message description"
}
```

## Examples

### Create a new HTTP monitor
```bash
curl -X POST http://localhost:3001/api/v2/monitors \
  -u admin:password \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API",
    "type": "http",
    "url": "https://api.example.com/health",
    "interval": 60
  }'
```

### Get all monitors with their status
```bash
curl -u admin:password http://localhost:3001/api/v2/monitors
```

### Pause a monitor
```bash
curl -X POST http://localhost:3001/api/v2/monitors/5/pause \
  -u admin:password
```

### Create a maintenance window
```bash
curl -X POST http://localhost:3001/api/v2/maintenance \
  -u admin:password \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Database Maintenance",
    "description": "Upgrading database server",
    "start_date": "2024-01-15T02:00:00Z",
    "end_date": "2024-01-15T04:00:00Z",
    "monitors": [1, 2]
  }'
```

## Rate Limiting

The API implements rate limiting:
- 60 requests per minute for API key authentication
- Standard rate limiting for username/password authentication

## Webhooks

While not part of the REST API, monitors can be configured to send webhooks on status changes. Configure webhook URLs in the monitor notification settings.