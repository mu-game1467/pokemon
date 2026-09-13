# User Sync Knowledge Base

## Overview
The Pokemon Champions Party Lab supports cross-browser user login and data sync.
User accounts are stored on both the client (localStorage) and server (API).

## Architecture

### Frontend (`index.html`)
- **Registration**: Username + password → hash with SHA-256 → stored in localStorage AND POST to API
- **Login**: Username + password → hash → check localStorage first, fallback to API GET
- **Data sync**: On save, write to both localStorage and API POST
- **Data load**: On load, prefer API GET, fallback to localStorage

### Backend (`api/user/[userId].js` - Vercel) / (`static-server.js` - local)
- GET `/api/user/:userId` - Returns stored user data (party, savedParties, battleLogs, account hash)
- POST `/api/user/:userId` - Stores/merges user data

### Data Storage
- **Vercel**: `/tmp/pokemon-champions-users/` (only writable directory in Vercel serverless)
- **Local**: `~/.pokemon-champions-data/users/` (via `static-server.js`)

## safeUserId() Function

Sanitizes usernames for file paths and API URLs:
```javascript
function safeUserId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 32);
}
```

**Example**: "muのKm2410545@" → "muKm2410545"

The sanitized ID is used in:
- API URL path (e.g., `/api/user/muKm2410545`)
- File path (e.g., `muKm2410545.json`)

## Known Issues & Fixes

### Issue 1: FUNCTION_INVOCATION_FAILED on Vercel
**Symptom**: User gets "A server error has occurred - FUNCTION_INVOCATION_FAILED" when logging in.
**Root cause**: The Vercel serverless function tried to use `os.homedir()` for the data directory,
which is read-only in Vercel's serverless environment.
**Fix**: Changed to `os.tmpdir()` which is writable in Vercel:
```javascript
const DATA_DIR = process.env.VERCEL ? path.join(os.tmpdir(), 'pokemon-champions-users') : path.join(os.homedir(), '.pokemon-champions-data', 'users');
```

### Issue 2: Missing req.params in Vercel serverless functions
**Symptom**: `req.query.userId` throws TypeError when `req.query` is undefined.
**Root cause**: Vercel's serverless function doesn't always populate `req.query`
or `req.params`.
**Fix**: Added optional chaining: `(req.query?.userId || req.params?.userId || '')`

### Issue 3: req.body undefined in POST requests
**Symptom**: POST handler crashes when trying to access `req.body.party`.
**Root cause**: In some Vercel runtime environments, `req.body` is not parsed
for JSON requests.
**Fix**: Added safety check: `const body = req.body || {};`

### Issue 4: Registration POST was fire-and-forget
**Symptom**: Account hash saved to localStorage but not to API, so login on
different browser fails (account not found).
**Root cause**: `fetchFromApi()` was called without `await`, so errors were silently ignored.
**Fix**: Added `await` and error logging:
```javascript
const apiResult = await fetchFromApi(userApiUrlForLogin(username), {
  method: 'POST',
  body: JSON.stringify({ account: account })
});
if (!apiResult) console.error('Failed to sync account to server');
```

## Login Flow

1. User enters username + password
2. Frontend hashes password with SHA-256 (via `crypto.subtle`)
3. Check localStorage for account:
   - Account exists + hash matches → login success
   - Account exists + hash mismatch → error "パスワードが間違っています"
4. If no local account, check API:
   - GET `/api/user/{safeUserId(username)}`
   - If API returns `account.hash` matching → save to localStorage, login success
   - Otherwise → "ユーザー名またはパスワードが間違っています"
5. Set `authUserId = username`
6. Call `loadAllFromServer()` to load party data:
   - Try API first: GET `/api/user/{safeUserId(username)}`
   - If API returns data → use it
   - If API fails → fallback to localStorage
7. Render party

## Registration Flow

1. User enters username + password (x2)
2. Check localStorage for existing account → error if duplicate
3. Hash password with SHA-256
4. Save to localStorage: `accounts[username] = { hash, createdAt }`
5. POST to API: `{ account: { hash, createdAt } }`
6. Show "登録成功！ログインしてください。"

## Data Persistence (saveAllToServer)

1. Save to localStorage with user-specific keys (e.g., `party-lab-{username}`)
2. POST to API: `{ party, savedParties, battleLogs, partyName, memo }`
3. API merges with existing data (preserves `account` field)

## Data Loading (loadAllFromServer)

1. If API returns data with `party` field → use API data
2. Otherwise → fallback to localStorage
3. Returns `true` on success, `false` on failure
