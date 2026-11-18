# ROMANZ: plan for the real backend

This plan covers the admin studio, the buying side (bag, checkout, payment), order tracking, and the database and image upload for products.

**Where we are now:** the app is React + Vite on Vercel. Everything runs in the browser. `src/lib/store.js` keeps products, orders, transactions, messages and settings in `localStorage`. `src/lib/auth.jsx` checks hard-coded passwords on the client. The UI already has what we need (shop, bag, checkout, `/account`, and the dashboard pages Overview, Orders, Products, Customers, Payments, Inbox, Team, Settings), so most of this work is **replacing the data layer, not the screens**.

---

## 1. Recommended stack

| Need | Choice | Why |
|---|---|---|
| Database | **Supabase Postgres** | Managed Postgres with row-level security (RLS) and a JS client, and it pairs well with a Vite SPA |
| Auth | **Supabase Auth** (email + password, magic link, Google optional) | Replaces the mock `USERS` list. Roles are stored in our own table |
| Image storage | **Supabase Storage** (`product-images` bucket, public read) with image transforms | Admins upload straight from the dashboard, and the storefront gets resized/WebP thumbnails |
| Server code | **Vercel Serverless Functions** in `/api/*` | Already deployed on Vercel. Holds the secrets (service key, payment merchant secret) |
| Card payments | **PayHere** (LKR, Visa/Master/Amex, eZ Cash, mCash, Genie) | The standard Sri Lankan gateway. Gives a hosted checkout plus a signed `notify_url` webhook |
| Pay in 3 | **Koko** (merchant API) | The mock already has a `koko` method. Integrate it in phase 4 |
| Cash on delivery | Built in | Order goes straight to "Confirmed" and staff mark the cash as collected |
| Email | **Resend** (or Brevo) | Order confirmation, shipped, delivered and refund emails |
| SMS (optional) | **Notify.lk** / Text.lk | Shipped/out-for-delivery texts, which Sri Lankan customers expect |
| Scheduled jobs | **Vercel Cron** | Expire unpaid orders, send daily low-stock email |

Alternative: Firebase does the same job, but RLS and SQL transactions make stock reservation much safer in Postgres, so we recommend Supabase.

---

## 2. Database schema

All tables have `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` unless noted. Money is stored as **integer LKR cents** (`bigint`) to avoid rounding errors.

### People & roles
```
profiles          id (= auth.users.id), full_name, phone, role ('customer'|'staff'|'manager'|'admin'), title
addresses         user_id → profiles, label, line1, line2, city, district, postal_code, phone, is_default
```

### Catalogue (the item upload side)
```
categories        slug (rings, necklaces, earrings, bracelets, sets), name, sort_order, is_active
products          slug unique, name, category_id, description, finish, tag,
                  base_price_cents, compare_at_cents null,
                  status ('draft'|'active'|'archived'), is_featured, seo_title, seo_description
product_variants  product_id, sku unique, option_label ('US 6', '45 cm', 'Pair'),
                  price_cents null (overrides base), stock int check (stock >= 0),
                  low_stock_threshold default 3, weight_g, is_active, sort_order
product_images    product_id, storage_path, alt, sort_order, is_primary
inventory_movements variant_id, delta int, reason ('order'|'cancel'|'restock'|'adjustment'|'return'),
                  order_id null, actor_id null, note
```
Stock is held **per variant**, so each ring size has its own count. Today's mock only has one stock number per product. `inventory_movements` is an audit trail: every stock change writes a row, which makes counts reconcilable.

### Orders, payments, tracking
```
orders            number unique ('RZ-10480' via a sequence), user_id null (guest checkout allowed),
                  email, phone, shipping_name, shipping_address jsonb, delivery ('standard'|'collection'),
                  subtotal_cents, shipping_cents, discount_cents, total_cents,
                  payment_method ('payhere'|'cod'|'koko'),
                  payment_status ('pending'|'paid'|'failed'|'cod_due'|'collected'|'refunded'|'partially_refunded'),
                  status ('pending_payment'|'confirmed'|'packed'|'shipped'|'out_for_delivery'|'delivered'|'cancelled'|'returned'),
                  tracking_token (random, for guest tracking link), gift_note, customer_note,
                  checkout_token unique (idempotency, already used in mock `place()`),
                  expires_at (for unpaid online orders)
order_items       order_id, variant_id, product_name, option_label, image_path,
                  unit_price_cents, qty          ← snapshot, so later price edits don't change old orders
payments          order_id, provider, provider_ref, amount_cents, status, raw jsonb (webhook body), received_at
order_events      order_id, type ('created'|'paid'|'packed'|'shipped'|...|'note'), message,
                  is_customer_visible bool, actor_id null      ← drives the tracking timeline
shipments         order_id, courier ('Domex'|'Pronto'|'Koombiyo'|'Prompt Xpress'|'Self'),
                  tracking_number, tracking_url, shipped_at, delivered_at
```

### Studio
```
messages          name, email, topic, body, is_read, order_id null   (contact form → Inbox)
settings          key pk, value jsonb    (announcement bar, support email, shipping fee, free-shipping threshold)
discount_codes    code, type ('percent'|'fixed'), value, min_subtotal_cents, starts_at, ends_at, max_uses, used   [phase 4]
audit_log         actor_id, action, entity, entity_id, diff jsonb
```

### Security rules (RLS)
- **Public (anon):** read `categories`, `products` where `status='active'`, their variants and images, and `settings`. Insert into `messages` only.
- **Customer:** read their own `profiles`, `addresses`, `orders`, `order_items`, and the `order_events` where `is_customer_visible`.
- **Staff:** read orders and update status through RPCs. Cannot refund or cancel paid orders, and cannot edit products (same as the current `ROLES` matrix).
- **Manager:** everything except team management and settings.
- **Admin:** everything.
- Prices, totals and stock are **never written from the browser**. Those changes only happen in serverless functions or `security definer` Postgres functions.

A helper `auth_role()` SQL function reads `profiles.role`. The policies use it, and the frontend uses the same value for `can()`.

---

## 3. Item upload (admin → Products)

Dashboard flow, which extends `src/pages/dash/Products.jsx`:

1. **New product** → fill in name, category, description, finish, tag, base price and status (draft until ready).
2. **Variants table** → add rows (size/length, SKU, price override, stock). Presets fill sizes from the category: rings get US 5–9, necklaces 40/45 cm, earrings "Pair".
3. **Images** → drag-and-drop several files.
   - Client checks type (jpg/png/webp) and size (≤ 8 MB), then uploads to `product-images/{product_id}/{uuid}.webp` using the Supabase client. A Storage policy allows only manager/admin to upload.
   - A row is written to `product_images`. Images can be dragged to reorder, a primary image can be picked, and alt text can be edited.
   - The storefront uses Supabase image transforms (`?width=600&quality=75&format=webp`) for thumbnails and `width=1600` on the product page.
4. **Publish** → status becomes `active` and the product appears in the shop.
5. **Restock / adjust** → a stock dialog writes an `inventory_movements` row with a reason, and the variant's stock updates in the same transaction.
6. **Bulk import (phase 4)** → CSV upload (`name, category, price, sku, option, stock, image_url`) for loading the client's real catalogue in one go.

Also: archive instead of delete (old orders still point at the product), duplicate a product, and a low-stock badge driven by `low_stock_threshold`.

---

## 4. Buying side: bag → checkout → payment

The bag can stay in `localStorage`. It only holds `{variant_id, qty}`, so a tampered bag cannot change prices.

```
Browser                       /api (Vercel)                         Supabase / PayHere
───────                       ─────────────                         ──────────────────
Bag → POST /api/quote  ──►    reprice from DB, check stock   ──►    returns lines + totals
Checkout form
POST /api/checkout     ──►    validate, call place_order() RPC ──►  one transaction:
  {items, customer,             (security definer):                   lock variants FOR UPDATE,
   delivery, method,            ─ insert order + items               check stock, decrement,
   checkout_token}              ─ reserve stock                      write inventory_movements,
                                ─ status = pending_payment (online)  write order_event 'created'
                                  or confirmed (COD)
                              if payhere: build form params + md5 hash with merchant secret
◄── {order number, payhere params | redirect}
Redirect to PayHere hosted page ─────────────────────────────────►  customer pays
                              POST /api/payhere/notify  ◄──────────  server-to-server webhook
                                verify md5sig, amount, currency
                                → payments row, payment_status=paid, status=confirmed,
                                  order_event 'paid', send confirmation email
Customer returns to /order/RZ-xxxx?t=token  (shows "processing" until the webhook lands)
```

Rules:
- **Idempotent:** the same `checkout_token` returns the same order. The mock already does this, so the logic carries over.
- **Reservation expiry:** unpaid online orders have `expires_at = now()+30 min`. A Vercel Cron job every 10 minutes calls `expire_unpaid_orders()`, which cancels them and returns the stock.
- **Never trust the return URL.** Only the signed webhook marks an order paid.
- **COD:** confirmed immediately with `payment_status='cod_due'`. Staff mark it `collected` on delivery, as the mock does today.
- **Koko (phase 4):** same pattern as PayHere, with its own webhook.
- **Guest checkout allowed.** If the email matches an account, the order is linked to it. After a guest checks out, offer "create an account to track orders".
- Shipping fee and free-shipping threshold come from `settings`, not a constant (`SHIPPING = 350` today).

---

## 5. Order tracking

### Status machine
```
pending_payment ─► confirmed ─► packed ─► shipped ─► out_for_delivery ─► delivered
       │               │           │          │                               │
       └─► cancelled ◄─┴───────────┘          └─► returned ◄──────────────────┘
```
A Postgres function `set_order_status(order_id, new_status, note)` enforces the allowed transitions and who may make them:
- staff: confirmed→packed→shipped→out_for_delivery→delivered
- manager/admin: also cancel and refund

Each transition writes an `order_events` row. Cancelling returns stock through `inventory_movements`.

### Admin side (Orders page)
- Filters: status, payment, method, date range, search by number/name/phone. Bulk "mark packed".
- Order drawer: line items, customer, address, payment log, timeline, internal notes.
- **Ship dialog:** pick the courier, enter the tracking number, and the tracking URL is built from a courier template. Saving sets the status to `shipped` and emails/SMSes the customer.
- Printable **packing slip** and **address label** (a browser print stylesheet is enough to start).
- Refund button (manager/admin) records the refund. Phase 4: call the PayHere refund API.

### Customer side
- `/account` → orders list with the timeline. This reuses the current `STEPS` UI, fed by `order_events`.
- **`/track`** → public page. The customer enters the order number and email (or opens the link from their email, `/track/RZ-10480?t=<tracking_token>`). It shows the timeline, the courier and a "track with courier" link. No login needed.
- Emails at: confirmed, shipped (with tracking link), delivered, cancelled/refunded.

Sri Lankan couriers mostly don't offer public tracking APIs, so **phase 1 uses manual tracking numbers plus deep links**. If the client signs with a courier that has an API (e.g. Koombiyo, Domex merchant portal), add a cron job that pulls status updates later.

---

## 6. Admin studio: what changes per page

| Page | Now (mock) | After |
|---|---|---|
| Overview | computed from localStorage | SQL views: `daily_sales`, `category_sales`, `low_stock_variants`. 12-week chart from `daily_sales` |
| Orders | `updateOrder()` | `set_order_status` RPC, ship dialog, slips, notes |
| Products | `product()` with sample image picker | full editor + variants + image upload (section 3) |
| Customers | derived from orders | `profiles` + guest emails, lifetime value view, order history per customer |
| Payments | mock transactions | `payments` table (real webhook events), refunds |
| Inbox | localStorage messages | `messages` table, reply by email (Resend), link to an order |
| Team | hard-coded `USERS` | invite staff by email (Supabase admin invite via `/api/team/invite`), change role, deactivate |
| Settings | announcement | announcement, shipping fee, free-ship threshold, support email/phone, courier list |
| Reset demo data | | removed in production (kept only in a `demo` env) |

---

## 7. Code changes in this repo

```
api/                         ← new, Vercel functions (Node)
  quote.js  checkout.js  payhere/notify.js  koko/notify.js
  orders/[id]/status.js  team/invite.js  cron/expire-orders.js  cron/low-stock.js
  _lib/supabaseAdmin.js  _lib/payhere.js  _lib/email.js
supabase/
  migrations/0001_schema.sql  0002_rls.sql  0003_functions.sql  (place_order, set_order_status, expire_unpaid_orders)
  seed.sql                   ← current sample catalogue from src/lib/catalog.js
src/lib/
  supabase.js                ← browser client (anon key)
  api.js                     ← replaces store.js functions one by one, same names where possible
  auth.jsx                   ← Supabase session + profiles.role; keep can()/homeFor() API
src/pages/site/Track.jsx  OrderStatus.jsx    ← new
src/pages/dash/ProductEditor.jsx  ImageUploader.jsx  ShipDialog.jsx  PackingSlip.jsx   ← new
```
Keep `useStore()` as the hook the pages use, but back it with data fetching (React Query or SWR) so the pages barely change. Keep `store.js` as a `VITE_DEMO=1` mode so the demo on Vercel still works without a backend.

Environment variables (set in Vercel, never committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_SANDBOX`, `RESEND_API_KEY`, `CRON_SECRET`.

---

## 8. Phases

| Phase | Scope | Rough effort |
|---|---|---|
| **1. Foundation** | Supabase project, schema + RLS migrations, seed catalogue, real auth (login/signup/reset), roles from `profiles`, storefront reads products from DB | 4–5 days |
| **2. Item upload** | Product editor, variants, image upload/reorder, stock adjustments, inventory log, categories | 3–4 days |
| **3. Buying + tracking** | `/api/quote`, `/api/checkout`, `place_order`, PayHere sandbox + webhook, COD, order confirmation page, `/track`, account orders, status machine, ship dialog, emails, expiry cron | 6–8 days |
| **4. Polish & extras** | Koko, refunds via API, discount codes, CSV import, packing slips, SMS, low-stock email, analytics views, audit log | 4–6 days |
| **5. Launch** | PayHere live approval (needs business docs, domain, policies pages), real photos and copy, privacy/returns/terms pages, backups, test orders end to end | 2–3 days + approval wait |

### Tests
- Extend `test-commerce.mjs` into SQL/RPC tests run against a local Supabase (`supabase start`). Cover overselling under parallel checkouts, idempotent checkout, expiry returning stock, illegal status transitions, and RLS (a customer cannot read another customer's order).
- Webhook tests with recorded PayHere payloads, including a bad signature and a wrong amount.
- Playwright smoke test: browse → add to bag → COD checkout → admin ships → customer sees "Shipped" on `/track`.

---

## 9. Decisions needed from the client
1. Payment gateway account: PayHere (recommended), and whether Koko is wanted at launch.
2. Which courier(s) they use, and whether delivery fees are flat or vary by district.
3. Guest checkout allowed? (recommended: yes)
4. Returns/exchange policy (drives the `returned` status and the refund rules).
5. Who needs dashboard access, and with which role.
6. Real product list, photos, and SKUs (CSV import makes loading these fast).
