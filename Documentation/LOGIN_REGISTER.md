# Login & Register System

## Overview

slotm uses **JWT-based cookie authentication** with CSRF protection. Users register with email and password, receive a signed JWT token stored in an httpOnly cookie, and are authenticated on subsequent requests by the JWT middleware.

---

## Authentication Flow

```
Registration:
  Browser → POST /api/auth/register { email, password }
    → AuthController.handleRegister()
      → AuthService.register()
        → Validate email (contains @) + password (≥6 chars)
        → Check email not already registered
        → hashPassword(password) → { hash, salt } (PBKDF2)
        → UserRepository.createUser(email, hash, salt)
        → issueJwtToken(user) → signed JWT
      → setJwtCookie(res, token) → Set-Cookie: slotm_jwt=...
    ← { success: true, data: { redirect: "/games", token } }
  Browser → window.location.href = "/games"

Login:
  Browser → POST /api/auth/login { email, password }
    → AuthController.handleLogin()
      → AuthService.login()
        → UserRepository.getUserByEmail(email)
        → verifyPassword(password, salt, hash) → boolean
        → issueJwtToken(user) → signed JWT
      → setJwtCookie(res, token) → Set-Cookie: slotm_jwt=...
    ← { success: true, data: { redirect: "/games", token } }
  Browser → window.location.href = "/games"

Subsequent Requests:
  Browser → GET /games (Cookie: slotm_jwt=...)
    → requireJwt middleware
      → Extract JWT from cookie (or Authorization header)
      → jwt.verify(token, secret, { issuer, audience })
      → Extract userId from sub claim
      → UserRepository.getUserById(userId)
      → Attach user to req.auth
    → PageController.handleGamesPage()
    ← Rendered HTML page

Logout:
  Browser → POST /api/auth/logout
    → AuthController.handleLogout()
      → clearJwtCookie(res) → Set-Cookie: slotm_jwt=; Max-Age=0
      → clearSessionCookies(res) → Clear slotm_sid + slotm_csrf
    ← { success: true, data: { redirect: "/login" } }
```

---

## Password Security

### Hashing Algorithm

| Setting | Value |
|---------|-------|
| Algorithm | PBKDF2 |
| Iterations | 210,000 |
| Key length | 32 bytes |
| Digest | SHA-256 |
| Salt | 32 random bytes (per user) |
| Output format | Hex string |

**Source:** `app/src/lib/security.ts`

```typescript
hashPassword(password, salt?)
  → crypto.pbkdf2(password, salt, 210000, 32, "sha256")
  → returns { salt: hex, hash: hex }

verifyPassword(password, salt, expectedHash)
  → hash with stored salt
  → crypto.timingSafeEqual(computed, expected)
  → returns boolean
```

### Password Validation

| Rule | Value |
|------|-------|
| Minimum length | 6 characters |
| Maximum length | None |
| Character requirements | None |
| Email format | Must contain `@` |
| Email normalization | Lowercase + trim |

---

## JWT Configuration

| Setting | Value | Source |
|---------|-------|--------|
| Algorithm | HS256 (default) | jsonwebtoken library |
| Secret | `JWT_SECRET` env var | `.env` file |
| Issuer | `"slotm"` | `AppConfig.jwtIssuer` |
| Audience | `"slotm-web"` | `AppConfig.jwtAudience` |
| Expiration | `JWT_EXPIRES_IN` env var | Default: `"14d"` |

### JWT Payload

```json
{
  "sub": 42,
  "email": "user@example.com",
  "iss": "slotm",
  "aud": "slotm-web",
  "iat": 1709568000,
  "exp": 1710777600
}
```

### JWT Type Guard

The `isJwtUserPayload()` type guard validates the decoded token:

```typescript
function isJwtUserPayload(value: unknown): value is JwtUserPayload {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.sub === "number" && typeof obj.email === "string";
}
```

---

## Cookie Configuration

### JWT Cookie (`slotm_jwt`)

| Setting | Value |
|---------|-------|
| Name | `slotm_jwt` |
| Path | `/` |
| HttpOnly | `true` (not accessible from JavaScript) |
| SameSite | `Lax` (sent on same-site requests + top-level navigations) |
| Secure | `true` in production (HTTPS only) |
| Max-Age | Matches `JWT_EXPIRES_IN` (default 14 days = 1,209,600 seconds) |

### Session Cookie (`slotm_sid`)

| Setting | Value |
|---------|-------|
| Name | `slotm_sid` |
| Purpose | Session ID for CSRF tracking |
| Generation | 24 random bytes → hex string |
| Storage | In-memory Map (not persistent) |
| TTL | Configurable (default 12 hours) |
| Cleanup | Every 200 requests |

### CSRF Cookie (`slotm_csrf`)

| Setting | Value |
|---------|-------|
| Name | `slotm_csrf` |
| Purpose | CSRF token for API requests |
| Generation | 32 random bytes → hex string |
| Validation | Compared against `X-CSRF-Token` request header |
| HttpOnly | `false` (must be readable by JavaScript) |

---

## CSRF Protection

All state-changing API requests require a valid CSRF token.

### Token Flow

```
1. Browser visits any page
2. ensureSession middleware creates session + CSRF token
3. CSRF token set in cookie: slotm_csrf=abc123
4. JavaScript reads cookie: getCsrfToken()
5. API request includes header: X-CSRF-Token: abc123
6. requireCsrf middleware validates header matches cookie
7. Request proceeds or is rejected with 403
```

### Client-Side CSRF (`app/src/client/http.ts`)

```typescript
function getCsrfToken(): string | null
  → Read "slotm_csrf" cookie value

function withCsrfHeaders(headers): Headers
  → Add "X-CSRF-Token" header
  → Add "X-Requested-With: XMLHttpRequest"

function fetchWithCsrf(url, init): Promise<Response>
  → Wrap fetch with CSRF headers + credentials: "same-origin"

function postJson<T>(url, payload): Promise<T>
  → POST JSON with CSRF, parse response, throw on !success
```

---

## JWT Middleware (`auth.middleware.ts`)

### Factory Function

```typescript
createJwtAuthMiddlewares({
  store,             // { getUserById }
  jwtSecret,         // JWT signing secret
  jwtIssuer,         // "slotm"
  jwtAudience,       // "slotm-web"
  jwtCookie,         // "slotm_jwt"
  jwtCookieMaxAgeSeconds,
  defaultJwtTtlSeconds,
  nodeEnv
})
```

### Returned Middleware Set

| Middleware | Purpose |
|-----------|---------|
| `optionalJwt` | Extract JWT if present, attach to `req.auth` (user may be null) |
| `requireJwt` | Validate JWT, return 401/redirect if missing |
| `setJwtCookie` | Set JWT in httpOnly cookie on response |
| `clearJwtCookie` | Expire JWT cookie |

### Token Extraction Priority

1. **Authorization header**: `Bearer <token>`
2. **Cookie**: `slotm_jwt=<token>`

### Authentication States

| State | `req.auth.user` | `req.auth.token` | Behavior |
|-------|-----------------|-------------------|----------|
| Authenticated | `SlotUser` | JWT string | Normal access |
| No token | `null` | `null` | requireJwt → redirect to `/login` |
| Invalid token | `null` | `null` | requireJwt → clear cookie + redirect |
| Expired token | `null` | `null` | requireJwt → clear cookie + redirect |

### Redirect Behavior (requireJwt)

- **API routes** (`X-Requested-With: XMLHttpRequest`): Return JSON `{ success: false, message: "Authentication required" }` with 401 status
- **Page routes**: Redirect to `/login?next=<current_url>` preserving the original destination

---

## Rate Limiting

| Limiter | Routes | Limit | Window |
|---------|--------|-------|--------|
| `authLimiter` | `/api/auth/*` | 40 requests | 15 minutes |
| `apiLimiter` | `/api/*` | 600 requests | 15 minutes |

Rate limiting is applied per IP address using `express-rate-limit`.

---

## Login Page

**Template:** `app/src/views/login.hbs`
**Route:** `GET /login`
**Auth required:** No (redirects to `/games` if already authenticated)

### Layout

```
┌──────────────────────────────────────┐
│     ☀ Blazing Sun Logo (4em)         │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │         Sign In                 │  │
│  │                                 │  │
│  │  Email:    [________________]   │  │
│  │  Password: [________________]   │  │
│  │                                 │  │
│  │  [       Sign In          ]     │  │
│  │                                 │  │
│  │  ┌─── Error Display ────────┐  │  │
│  │  │                          │  │  │
│  │  └──────────────────────────┘  │  │
│  │                                 │  │
│  │  Don't have an account?         │  │
│  │  Create account →               │  │
│  └─────────────────────────────────┘  │
│                                       │
│  [Canvas: Space Star Background]      │
└──────────────────────────────────────┘
```

### Form Handling

- Hidden `next` field preserves redirect target from URL query parameter
- Form submission intercepted by JavaScript (`auth.ts`)
- Errors displayed inline in `#authError` div
- On success: `window.location.href = redirect`

### Scripts Loaded

| Script | Purpose |
|--------|---------|
| `blazing-background.js` | Animated space star field background |
| `auth.js` | Form submission handler (login/register) |

---

## Register Page

**Template:** `app/src/views/register.hbs`
**Route:** `GET /register`
**Auth required:** No (redirects to `/games` if already authenticated)

### Layout

```
┌──────────────────────────────────────┐
│     ☀ Blazing Sun Logo (4em)         │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │       Create Account            │  │
│  │  Get a wallet to play           │  │
│  │                                 │  │
│  │  Email:    [________________]   │  │
│  │  Password: [________________]   │  │
│  │            (min 6 characters)   │  │
│  │                                 │  │
│  │  [     Create Account     ]     │  │
│  │                                 │  │
│  │  ┌─── Error Display ────────┐  │  │
│  │  │                          │  │  │
│  │  └──────────────────────────┘  │  │
│  │                                 │  │
│  │  Already have an account?       │  │
│  │  Sign in →                      │  │
│  └─────────────────────────────────┘  │
│                                       │
│  [Canvas: Space Star Background]      │
└──────────────────────────────────────┘
```

### Password Validation

- Client-side: `minlength="6"` on password input
- Server-side: `password.length >= 6` in AuthService
- Validator chain: `body("password").isString().isLength({ min: 6 })`

---

## Request Validation

### Login Validators (`auth.validators.ts`)

```typescript
loginValidator = [
  body("email").isString().trim().isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 1 }),
  body("next").optional().isString()
]
```

### Register Validators

```typescript
registerValidator = [
  body("email").isString().trim().isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 6 }),
  body("next").optional().isString()
]
```

---

## Error Handling

### Custom Error Types

| Error | Status | When Thrown |
|-------|--------|------------|
| `AuthValidationError` | 400 | Invalid email format, password too short, email already registered |
| `AuthCredentialsError` | 401 | Wrong email/password combination |

### Error Response Format

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

### Client-Side Error Display

```typescript
// auth.ts
catch (error) {
  const msg = error instanceof Error ? error.message : "Something went wrong";
  authErrorDiv.textContent = msg;
  authErrorDiv.hidden = false;
}
```

---

## Security Measures

| Measure | Implementation |
|---------|----------------|
| Password hashing | PBKDF2, 210,000 iterations, SHA-256 |
| Timing-safe comparison | `crypto.timingSafeEqual()` for password verification |
| HttpOnly cookies | JWT cookie not accessible from JavaScript |
| SameSite=Lax | Protects against CSRF on cross-origin POST |
| CSRF tokens | Double-submit cookie pattern |
| Rate limiting | 40 auth requests per 15 min per IP |
| Secure flag | HTTPS-only cookies in production |
| Input validation | express-validator chains on all endpoints |
| Email normalization | Lowercase + trim before storage and lookup |
| Open redirect prevention | `sanitizeRedirectTarget()` validates redirect URLs |
