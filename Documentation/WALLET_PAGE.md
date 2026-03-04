# Wallet Page

## Overview

The wallet page manages the player's balance, payment methods, and transaction history. It integrates with Stripe for credit card payments.

**View:** `app/src/views/wallet.hbs`
**Client:** `app/src/client/wallet.ts`
**Route:** `GET /wallet`
**API routes:** `app/src/routes/wallet.routes.ts`

---

## Page Layout

```
┌─────────────────────────────────────────────┐
│  Topbar (Logo + Navigation + User Info)     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  Balance: 12,500 credits             │   │
│  ├──────────────────────────────────────┤   │
│  │  Quick Add                           │   │
│  │  [+500] [+1000] [+2500] [+5000]     │   │
│  │                                      │   │
│  │  Custom Amount: [_______] [Add]      │   │
│  ├──────────────────────────────────────┤   │
│  │  Payment Methods                     │   │
│  │  [Add/Update Card]                   │   │
│  │                                      │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │ Brand  │ Last 4 │ Exp │ Status│   │   │
│  │  │ Visa   │ 4242   │ 12/27│ Active│  │   │
│  │  └──────────────────────────────┘    │   │
│  ├──────────────────────────────────────┤   │
│  │  Transaction History                 │   │
│  │                                      │   │
│  │  ┌────────────────────────────────┐  │   │
│  │  │ Date │ Type │ Amount │ Balance │  │   │
│  │  │ 3/03 │ Win  │ +250   │ 12,750 │  │   │
│  │  │ 3/03 │ Bet  │ -100   │ 12,500 │  │   │
│  │  │ 3/02 │ Top Up│ +5000 │ 12,600 │  │   │
│  │  └────────────────────────────────┘  │   │
│  │  Page: [1] [2] [3] ... [Jump to: __] │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  (Space star field background)              │
└─────────────────────────────────────────────┘
```

---

## Features

### Balance Display

- Current credit balance shown prominently at the top
- Auto-refreshes when the browser tab regains focus (`slot-page.ts`)
- Balance fetched from `GET /api/wallet/balance`
- Conversion ratio: 100 balance units = 1 coin unit (`BALANCE_TO_COIN_RATIO`)

### Quick Add Buttons

Pre-set top-up amounts for fast credit purchases:

| Button | Credits Added |
|--------|---------------|
| +500 | 500 credits |
| +1,000 | 1,000 credits |
| +2,500 | 2,500 credits |
| +5,000 | 5,000 credits |

### Custom Amount

- Free-form input field for any top-up amount
- Redirects to Stripe Checkout for payment processing
- Returns to wallet page on completion

### Payment Methods (Stripe)

- **Add Card** — Opens Stripe setup to save a new card
- **Update Card** — Replace existing saved card
- **Saved Cards Table** — Displays:
  - Card brand (Visa, Mastercard, etc.)
  - Last 4 digits
  - Expiration date
  - Status (Active/Expired)

### Transaction History

- Paginated table of all wallet transactions
- **Transaction types:** Top Up, Bet, Win, Bonus
- **Columns:** Date, Type, Amount (+/-), Running Balance
- **Pagination:** Page numbers + "Jump to page" input
- All transactions logged with descriptions in PostgreSQL

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet/balance` | Get current balance |
| POST | `/api/wallet/topup` | Initiate credit top-up |
| POST | `/api/wallet/stripe/setup` | Setup payment method |
| POST | `/api/wallet/stripe/checkout` | Create checkout session |
| POST | `/api/wallet/stripe/webhook` | Handle Stripe events |

---

## Stripe Integration

The wallet uses Stripe for payment processing:

1. **Customer creation** — Each user gets a Stripe customer ID on first payment
2. **Checkout sessions** — Stripe hosted payment page for secure card entry
3. **Webhooks** — Stripe notifies the server on successful payment
4. **Saved cards** — Cards stored in Stripe, referenced by payment method ID
5. **Balance update** — Credits added to user balance after webhook confirmation

---

## Security

- All payment processing handled by Stripe (PCI compliant)
- Webhook signature verification prevents spoofed events
- CSRF protection on all POST endpoints
- JWT authentication required
- Balance changes logged as auditable transactions
- Fraud check on balance deduction (cannot go below zero)
