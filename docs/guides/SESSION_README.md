# Minimal Redis Session Management

This document describes the minimal session management system implemented using Redis.

## Overview

The session system provides:
- Session creation, retrieval, update, and deletion
- Automatic session expiration (1 hour default)
- Cookie-based session management
- Session middleware for request authentication
- RESTful API endpoints

## Architecture

### Components

1. **Session Service** (`services/session-service.js`)
   - Core session operations (CRUD)
   - Redis integration for storage
   - TTL management for automatic expiration

2. **Session Middleware** (`middleware/session-middleware.js`)
   - Extracts session ID from cookies/headers
   - Automatically loads session data
   - Attaches session and user to request object

3. **Session Controller** (`controllers/session-controller.js`)
   - HTTP request handlers
   - Input validation
   - Response formatting

4. **Session Routes** (`routes/session-routes.js`)
   - RESTful API endpoints
   - Route definitions

## API Endpoints

### Create Session
```
POST /api/sessions
Content-Type: application/json

{
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### Get Session
```
GET /api/sessions/:sessionId
```

### Update Session
```
PUT /api/sessions/:sessionId
Content-Type: application/json

{
  "user": {
    "name": "Updated Name"
  }
}
```

### Delete Session
```
DELETE /api/sessions/:sessionId
```

### Refresh Session
```
POST /api/sessions/:sessionId/refresh
```

### Get Current Session
```
GET /api/current
```

## Session Storage

Sessions are stored in Redis with the following structure:

```
Key: session:{sessionId}
Value: {
  "id": "uuid",
  "user": { "id": "user123", "email": "...", "name": "..." },
  "createdAt": "2025-01-01T00:00:00.000Z",
  "lastAccessed": "2025-01-01T00:30:00.000Z"
}
TTL: 3600 seconds (1 hour)
```

## Usage Examples

### Basic Session Creation
```javascript
const userData = { id: 'user123', email: 'test@example.com' };
const { sessionId } = await sessionService.createSession(userData);
```

### Session Middleware Usage
```javascript
import sessionMiddleware from './middleware/session-middleware.js';

app.use('/protected', sessionMiddleware, (req, res) => {
  if (!req.session) {
    return res.status(401).json({ error: 'No active session' });
  }
  res.json({ user: req.user });
});
```

## Configuration

Session configuration can be modified in `services/session-service.js`:

- `defaultTTL`: Session expiration time (default: 3600 seconds)
- `sessionPrefix`: Redis key prefix (default: "session:")

## Testing

Run the session service test:
```bash
node tests/session-test.js
```

## Security Notes

- Sessions use HTTP-only cookies by default
- Secure cookies enabled in production
- Session IDs are UUID v4
- Sessions automatically expire
- Redis should be secured with authentication

## Dependencies

- `ioredis`: Redis client
- `uuid`: Session ID generation
- `cookie-parser`: Cookie parsing middleware
