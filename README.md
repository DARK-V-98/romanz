# ROMANZ jewellery — demo store + studio dashboard

React + Vite single-page app. **Everything is mock**: data lives in the browser's localStorage, logins are checked client-side, and no payment or email leaves the page.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # commerce logic tests
npm run build    # outputs dist/
```

## Deploy to Vercel
Import the repo in Vercel (framework is auto-detected as Vite) or run `npx vercel`. `vercel.json` rewrites every path to `index.html` so deep links like `/dashboard/orders` work.

## Demo logins (`/login`)
| Role | Email | Password | Sees |
|---|---|---|---|
| Administrator | admin@romanz.lk | admin123 | Everything incl. team, audit log & settings |
| Store manager | manager@romanz.lk | manager123 | Orders (incl. cancel/refund/returns), products, discounts, customers, payments, inbox, outbox |
| Fulfilment staff | staff@romanz.lk | staff123 | Orders (pack, ship, deliver only), inbox, outbox |
| Customer | customer@romanz.lk | customer123 | `/account`: orders with tracking, profile, address book |

Customers can also create an account or reset a password (the reset code arrives in **Studio → Outbox**).

## What's mocked
Every part of [docs/BACKEND_PLAN.md](docs/BACKEND_PLAN.md) runs as a working mock in `src/lib/store.js`, so the flows can be tested before the real backend exists:

| Plan item | Mock |
|---|---|
| Database tables | localStorage state v4: products + variants (per-size SKU & stock), categories, orders with events/shipment/notes, payments, inventory movements, discounts, users, messages, outbox, audit log |
| Item upload | Product editor with multi-photo upload (drag & drop, reorder, cover), resized to 1000 px in the browser and kept in a separate localStorage "bucket"; sizes/options with SKUs, price overrides and low-stock alerts; draft/live/archived; duplicate; stock adjustments with reasons; inventory log; categories; CSV import with preview |
| Checkout (`/api/checkout`) | Server-style repricing, stock reservation, discount codes, free-delivery threshold, idempotent checkout token, guest or signed-in checkout with saved addresses |
| Payment gateway + webhook | `/pay/:id` mock hosted page → signed notification → only a valid signature and amount mark the order paid. Includes a "forged webhook" button to show rejection, declines, duplicates and late payments |
| Expiry cron | Unpaid card/Koko orders release stock after the payment window (checked every 30 s, or run manually in Settings) |
| Order status machine | Pending payment → Confirmed → Packed → Shipped (courier + tracking no.) → Out for delivery → Delivered, plus Cancelled/Returned. Staff vs manager permissions enforced in the store, not just hidden in the UI |
| Tracking | `/track` lookup by order number + email, private `/track/:id?t=` links, `/order/:id` confirmation, timeline in My account |
| Emails / SMS | Written to **Studio → Outbox** instead of being sent |
| Admin | Bulk mark packed, filters, CSV export, printable packing slips & labels, internal notes, COD collection, refunds, team invites & roles, audit log, settings for delivery fee, couriers and payment window |
| Reviews & ratings | Star ratings on cards and product pages, review form, "verified buyer" when the same email received the piece, moderation queue (publish/hide/reply) in **Studio → Reviews** |
| Wishlist & recently viewed | ♡ on every piece, `/wishlist`; saved in the browser for guests and moved into the account on sign-in |
| Back-in-stock alerts | "Notify me" on sold-out sizes; restocking the size emails everyone waiting, once. Demand list in **Products → Waitlist** |
| Returns & exchanges (RMA) | Customers request a refund or a different size from My account within the return window; managers approve (return label) or reject; staff check the parcel in → partial refund or a free replacement order, stock returned |
| Courier status webhook | Courier simulator in the order drawer (arrived at hub, out for delivery, failed attempt, delivered), or switch on auto-courier in Settings to watch tracking advance by itself |
| Reports | 7 / 30 / 90 / 365-day net revenue, AOV, refunds, discounts, repeat-customer and cancellation rates, payment-method and city split, top pieces with CSV export |
| Studio realtime | Notification bell + toasts for new orders, payments, messages, reviews, returns and waitlist demand (works across tabs) |
| Command palette | <kbd>Ctrl/⌘ K</kbd> in the studio jumps to any page, order, product or customer |

Sample data is seeded deterministically (64 orders with timelines, reviews, messages, discount codes, a waitlist). Data saved by the previous version is migrated, not wiped. Try code `WELCOME10` at checkout.

Photography is Unsplash sample imagery (see ASSETS.md). Before production you need the real backend from the plan: a database, real auth, server-side price/stock validation, a payment gateway with signed webhooks, real email/SMS, and the client's real content.
