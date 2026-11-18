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
| Administrator | admin@romanz.lk | admin123 | Everything incl. team & settings |
| Store manager | manager@romanz.lk | manager123 | Overview, orders, products, customers, payments, inbox |
| Fulfilment staff | staff@romanz.lk | staff123 | Overview, orders (ship only, no cancel/refund), inbox |
| Customer | customer@romanz.lk | customer123 | `/account`: own order history & tracking |

## What's in it
- **Store:** home, shop (filters/search/sort), product, bag, checkout (mock card with approve/decline/cancel, COD, pay-in-3), story, care, journal, contact (messages land in the dashboard inbox).
- **Dashboard:** KPIs, 12-week revenue chart, category sales, low stock, orders with status drawer, product editor, customers, payment event log, inbox, role matrix, settings (announcement bar) and **Reset demo data**.
- Sample data is seeded deterministically (64 orders, messages) in `src/lib/store.js`; copy and testimonials in `src/lib/content.js`.

Photography is Unsplash sample imagery (see ASSETS.md). Before production you need: a real database, real auth, server-side price/stock validation, a payment gateway with signed webhooks, and the client's real content.
