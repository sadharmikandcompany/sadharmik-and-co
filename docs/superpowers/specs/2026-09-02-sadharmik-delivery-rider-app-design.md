# Sadharmik & Co. — Delivery Rider App Design

## Context

Sadharmik & Co. already runs `crm/` (`sadharmik-crm`) — a private Next.js +
Prisma/Postgres back-office app (see `docs/superpowers/specs/2026-08-26-khakhra-crm-design.md`).
Orders are entered there (via the POS screen or directly) and carry a status
(`NEW` → `ROASTING` → `OUT_FOR_DELIVERY` → `DELIVERED`), but there is no
concept of a delivery rider today — nobody is assigned to an order, and there
is no mobile app for delivery staff.

As a reference, the user shared a screen recording of **"Kalapurna Delivery —
Driver Portal"** — a separate, already-live app used for a different brand
(Kalapurna Ghee/Oils) the same family business runs. It is not connected to
`sadharmik-crm` and its backend is out of scope here; it's purely a reference
for feature set and visual style. It includes: a dashboard with daily
stats/collections/performance, a delivery list with Pending/In
Progress/Complete/All tabs and live counts, order cards (VIP badge, tap-to-call
phone, tap-to-navigate address, payment method + amount, priority flag),
rescheduling, balance/COD reconciliation, expense tracking, downloadable daily
delivery-sheet PDFs, and a profile screen with service-area pincodes.

The user wants an equivalent rider app for Sadharmik & Co.'s own deliveries,
built and hosted entirely with free tools, starting with a leaner v1 rather
than full feature parity.

## Goal

An Android app that a Sadharmik & Co. delivery rider logs into to see the
orders assigned to them, get the customer's phone/address, and mark each one
Delivered or Failed — reading from and writing to the same `sadharmik-crm`
database that the back-office already uses.

## Non-goals (v1)

Explicitly deferred to a later phase, matching features seen in the Kalapurna
reference app but not built now:

- Dashboard stats (today's assigned/delivered/pending/failed counts,
  collections total, performance/rating)
- Balance/COD collection reconciliation
- Expense tracking
- Downloadable delivery-sheet PDFs
- Rescheduling workflow
- Priority-order flagging
- Service-area (pincode) restriction on a rider's profile
- iOS support (Android only, see Architecture)
- Push notifications (rider pulls to refresh instead)
- Photo proof of delivery / payment-collected entry on the delivery action
  itself (v1 is just Delivered/Failed)

## Architecture

- **App**: React Native via Expo, Android only. Free, unlimited local builds
  (`eas build --local`) avoid both the Apple Developer fee and any paid EAS
  cloud-build credits.
- **Distribution**: a signed APK shared directly with riders to sideload (no
  Play Store account/fee).
- **Backend**: new API routes added to the existing `crm/` Next.js app under
  `/api/rider/*`, reusing the existing Prisma/Postgres database — no new
  service to host or pay for.
- **Auth**: phone number + password (checked against the existing `User`
  table, filtered to `role: DELIVERY_PARTNER` and `isActive`), returning a
  signed token (same HMAC approach `lib/auth.ts` already uses for the CRM's
  own login, adapted to a bearer token instead of a cookie, since the client
  is a mobile app, not a browser). The app stores the token with Expo
  SecureStore and sends `Authorization: Bearer <token>` on every request; an
  expired/invalid token bounces the app back to Login.
- **Rollout in two phases** (per the user's request to prove it locally
  first):
  1. **Local phase**: CRM runs via `npm run dev` on the dev machine; the
     Expo app runs via Expo Go on a phone on the same WiFi, pointed at the
     dev machine's local network IP. Used to build and verify the whole
     flow end-to-end before spending effort on deployment/signing.
  2. **Production phase**: once verified locally, deploy `crm/` to Vercel's
     free tier (so riders can reach it over mobile data from anywhere) and
     build the signed release APK pointed at that URL.

## Data model changes (`crm/prisma/schema.prisma`)

**Superseded note:** this section originally proposed a new, separate
`Rider` model. While writing this spec, unrelated in-progress work already
sitting in the CRM's working tree turned out to cover the same ground: a
`User` model with a `Role` enum (`ADMIN / STAFF / DELIVERY_PARTNER`) and an
`Order.deliveryPartnerId` relation. Rather than add a second, competing
"who does this order belong to" concept, this build reuses that existing
`User`/`Role` model as the rider identity — a rider *is* a `User` with
`role: DELIVERY_PARTNER`. That existing work is not yet migrated to the
database or fully wired up (no UI to assign a partner to an order yet, and
new-user passwords are stored in plaintext) — both are finished as part of
this work, below.

What's added on top of the existing `User`/`Order.deliveryPartnerId` work:

- `User.passwordHash` switches from storing the plaintext password to a
  bcrypt hash (the existing `users/actions.ts` `createUser` action currently
  writes `passwordHash: password` verbatim — fixed here since this build
  adds a real internet-facing login for that same field).
- `OrderStatus` enum gains `FAILED` alongside the existing
  `NEW / ROASTING / OUT_FOR_DELIVERY / DELIVERED`.
- `Order` gains `deliveryNotes String?` (failure reason, or any rider note
  left on delivery) — `deliveryPartnerId` already exists.
- `Customer.vipNumber` (already exists, already migrated conceptually via
  the pending schema change) is reused as-is for the "VIP ####" badge seen
  in the reference app — no new field needed.

CRM UI change: the Sales order-detail page (`sales/[id]/page.tsx`) gets an
"Assign delivery partner" dropdown (active `DELIVERY_PARTNER` users only) —
today it has a status selector but no assignment control at all, so this is
new, not a change to existing behavior. The already-built `/users` (create a
user, pick role) and `/delivery-partners` (view a partner's current
assignments) pages are used as-is.

## API routes (`crm/app/api/rider/*`)

- `POST /api/rider/login` — `{ phone, password }` → `{ token }`. Rejects
  inactive/non-delivery-partner users and bad credentials with the same
  response either way (no "wrong password" vs "no such user" distinction,
  avoiding phone-number enumeration).
- `GET /api/rider/orders?status=pending|complete|failed` — orders where
  `deliveryPartnerId` = the authenticated user and status matches
  (`pending` → `OUT_FOR_DELIVERY`, `complete` → `DELIVERED`, `failed` →
  `FAILED`), newest first, with customer + order items included.
- `POST /api/rider/orders/:id/deliver` — sets status `DELIVERED`; 403 if the
  order isn't assigned to the calling rider or isn't currently
  `OUT_FOR_DELIVERY`.
- `POST /api/rider/orders/:id/fail` — `{ reason }` → sets status `FAILED` +
  `deliveryNotes`; same ownership/status guard as above.

All four routes are exercised by Vitest tests (auth rejection, wrong-rider
rejection, wrong-status rejection, happy path), matching how the CRM's
existing routes are already tested.

## App screens

- **Login** — phone + password fields, Sign In button. Deep green/gold
  theme matching the Sadharmik & Co. brand (not the Kalapurna app's blue).
- **My Deliveries** — three tabs with live counts: *Pending / Complete /
  Failed*. Each order card: order number, VIP badge (customer's
  `vipNumber`), customer name, phone (tap to call), address (tap to open in
  Google Maps — a plain deep link, no Maps API key or cost), item count,
  payment method + total amount.
- **Order detail** (tap a card) — full item list, Call button, Navigate
  button, **Mark Delivered** button, **Mark Failed** button (opens a
  single-line reason field before confirming).
- **Profile** — rider's name, phone, Logout button.

## Error handling & edge cases

- Network/offline failures on any screen show a retry banner rather than a
  blank screen or crash.
- Marking an order Delivered/Failed twice, or an order that got reassigned
  to someone else mid-shift, is caught by the API's ownership/status guard
  (above) and shown to the rider as "This order was already updated" rather
  than silently double-processing.
- The app's list screens define explicit empty states ("No pending
  deliveries", etc.) rather than a blank list.

## Testing approach

- New `/api/rider/*` routes: Vitest, same pattern as the CRM's existing
  route tests.
- The Expo app itself: manual testing on a real Android phone during the
  local phase (per Architecture, above) — no automated E2E harness, matching
  the CRM's own "manual verification pass" approach for a small internal
  tool.

## Open questions / future phases (explicitly out of scope now)

- Dashboard stats, Balance/COD reconciliation, Expense tracking, delivery
  sheet PDFs, rescheduling, priority orders, ratings, service-area pincodes
  — all deferred until v1 is in daily use and the next set of priorities is
  clear.
- Whether Sadharmik & Co. ever wants the Kalapurna app and this app unified
  into one codebase — out of scope; they remain two separate systems today.
