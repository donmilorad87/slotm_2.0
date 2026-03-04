# Profile Page

## Overview

The profile page allows users to manage their account details including personal information, profile picture, and password.

**View:** `app/src/views/profile.hbs`
**Route:** `GET /profile`
**API routes:** `app/src/routes/profile.routes.ts`

---

## Page Layout

```
┌─────────────────────────────────────────────┐
│  Topbar (Logo + Navigation + User Info)     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  Profile Picture                     │   │
│  │  ┌────────┐                          │   │
│  │  │  👤    │  [Upload New Picture]    │   │
│  │  └────────┘                          │   │
│  ├──────────────────────────────────────┤   │
│  │  Personal Information                │   │
│  │  First Name: [___________]           │   │
│  │  Last Name:  [___________]           │   │
│  │  Email:      user@example.com (read) │   │
│  │  [Update Profile]                    │   │
│  ├──────────────────────────────────────┤   │
│  │  Change Password                     │   │
│  │  Current:  [___________]             │   │
│  │  New:      [___________]             │   │
│  │  Confirm:  [___________]             │   │
│  │  [Change Password]                   │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  (Space star field background)              │
└─────────────────────────────────────────────┘
```

---

## Features

### Profile Picture

- Upload with live preview before saving
- Accepted formats: JPEG, PNG, GIF, WebP
- Maximum file size: 2MB
- Processed via Multer on the server
- Stored in the uploads volume

### Personal Information

- **First Name** — Editable text field
- **Last Name** — Editable text field
- **Email** — Read-only display (cannot be changed after registration)
- Changes submitted via `POST /api/profile/update`

### Password Change

- **Current Password** — Required for verification
- **New Password** — Must meet security requirements
- **Confirm Password** — Must match new password
- Submitted via `POST /api/profile/change-password`
- Password hashed with bcrypt + salt on the server

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/profile/update` | Update first/last name |
| POST | `/api/profile/change-password` | Change password |
| POST | `/api/profile/upload-picture` | Upload profile picture |

All endpoints require authentication (JWT cookie) and include CSRF token validation.

---

## Form Handling

Forms use inline `fetch()` calls with CSRF tokens extracted from cookies. Responses display success/error messages via DOM manipulation. No page reload required — all updates happen asynchronously.

---

## Security

- CSRF protection on all POST requests
- JWT authentication required
- Password verification before allowing password change
- File upload validation (type + size) on both client and server
- bcrypt password hashing with salt
