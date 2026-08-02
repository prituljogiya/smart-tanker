# Smart Tanker — Backend (NestJS)

Real-time water tanker booking & tracking backend. Serves both government
(free/subsidized) and private-operator (fully paid) tenants on one
multi-tenant codebase — see the architecture and operating-model docs for
the full design rationale.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ with the **PostGIS** extension available
- Redis 6+

## Setup

```bash
npm install
cp .env.example .env
# edit .env with your DB / Redis / Razorpay credentials
```

Generate a 32-byte hex key for field-level PII encryption:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# paste the output into FIELD_ENCRYPTION_KEY in .env
```

Create the database, then run migrations (this also enables PostGIS and
sets up row-level security policies):

```bash
createdb smart_tanker
npm run migration:run
```

Start the dev server:

```bash
npm run start:dev
```

The API listens on `http://localhost:3000`. The WebSocket gateway is
available at the same host under the `/realtime` namespace.

## What's implemented

- **Auth**: phone-OTP login stub issuing JWT access + refresh tokens (wire
  up a real SMS/OTP provider in `auth.service.ts`)
- **Tenants**: government vs private tenant config, pricing rules as JSON
- **Users**: resident/driver/admin accounts, phone & address encrypted at
  rest (AES-256-GCM)
- **Tankers**: fleet entity + PostGIS nearest-available-tanker query
- **Requests**: full booking lifecycle — pricing rules engine → optional
  payment → dispatch → live tracking → OTP-confirmed delivery
- **Realtime**: Socket.io gateway + Redis pub/sub fan-out, scoped per
  tanker/request/fleet channel (not a global broadcast)
- **Payments**: Razorpay webhook handler with signature verification and
  idempotent processing
- **Notifications**: BullMQ queue for anything that shouldn't block the
  request/response cycle (push notifications, alerts)

## Still to wire up (marked `TODO` in code)

- Real OTP delivery via an SMS provider or Firebase Auth
- Firebase Cloud Messaging push notification sending
- `TenantContextInterceptor` isn't yet registered globally — wire it into
  `main.ts` (`app.useGlobalInterceptors(...)`) once you're ready to rely on
  the row-level security policies in the initial migration
- Rate cards are currently a flat per-1000-liters number in `tenant.rules`;
  extend to a proper `rate_cards` table if you need per-tanker-size tiers
- End-to-end encrypted chat between resident and driver (separate from the
  location/data encryption already in place)

## Project layout

```
src/
  auth/           JWT auth, guards, roles
  tenants/        Government/private tenant config
  users/          Resident/driver/admin accounts (encrypted PII)
  tankers/        Fleet + PostGIS nearest-tanker queries
  requests/       Booking lifecycle, pricing rules engine
  payments/       Razorpay webhook handling
  realtime/       WebSocket gateway + Redis pub/sub
  common/         Shared base entities, encryption transformer, interceptors
migrations/       SQL schema, PostGIS setup, row-level security policies
```
