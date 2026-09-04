# Sadharmik & Co. — Internal CRM

A private, local back-office app for managing customers, products, orders
(POS), sales, and purchases. Not linked to or visible from the public
`index.html` site — this is for the owner/staff only.

## First-time setup

```bash
cd crm
npm install
cp .env.example .env
```

Edit `.env` and set a real `CRM_USERNAME` and `CRM_PASSWORD` (this is the
login), and a random `CRM_SESSION_SECRET` (any long random string — used to
sign the login session, not something you need to remember).

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

## Running it

```bash
npm run dev
```

Open `http://localhost:3000`, log in with the username/password from `.env`.

## Running the tests

```bash
npm test
```

## Data model

See `prisma/schema.prisma` for the full data model: Product (item master),
Customer, Supplier, Order/OrderItem, Purchase/PurchaseItem.

## Pages

- `/dashboard` — sales stats, low-stock alerts, recent orders
- `/customers` — list, search, add; click a row for order history
- `/products` — item master (add/edit flavour, price, stock)
- `/pos` — build a bill and save it as an order (this is the order-creation
  screen)
- `/sales` — order register with status/date filters
- `/purchases` — suppliers + raw-material purchase register

## Delivery rider API

`/api/rider/*` is a separate, token-authenticated API for the Sadharmik
Delivery Android app (not the browser session used by the rest of the CRM).
A rider is a `User` row with `role: DELIVERY_PARTNER` — create one from
`/users`, then assign them to orders from an order's detail page
(`/sales/<id>`).

Requires `RIDER_TOKEN_SECRET` in `.env` (see `.env.example`) — a long random
string, separate from `CRM_SESSION_SECRET`.

Routes: `POST /api/rider/login`, `GET /api/rider/me`,
`GET /api/rider/orders?status=pending|in_progress|complete|failed|rescheduled`,
`GET /api/rider/orders/:id`, `POST /api/rider/orders/:id/pickup`,
`POST /api/rider/orders/:id/deliver`, `POST /api/rider/orders/:id/fail`,
`POST /api/rider/orders/:id/reschedule`, `GET /api/rider/dashboard`,
`GET /api/rider/balance`, `GET /api/rider/expenses` + `POST
/api/rider/expenses`, `GET /api/rider/delivery-sheet?filter=today|all`. All
except `login` require `Authorization: Bearer <token>`.

An order's lifecycle is now `OUT_FOR_DELIVERY → PICKED_UP →
DELIVERED / FAILED / RESCHEDULED` — a rider must mark an order "Picked Up"
before they can mark it Delivered, Failed, or Reschedule it (previously this
was a single `OUT_FOR_DELIVERY → DELIVERED/FAILED` step).

See `delivery-app/README.md` for the Android app itself.
