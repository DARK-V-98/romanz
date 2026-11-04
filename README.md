# ROMANZ jewellery demo

Serve the `dist` directory with `python -m http.server 4173 --directory dist`.

- Store: `/collection.html` — 18 illustrative styles, search, categories, sizes and bag.
- Checkout: `/checkout.html` — sample customer details, delivery selection, mock online/COD/Koko-style payments.
- Customer orders: `/orders.html` — order snapshots and fulfillment status.
- Admin: `/admin.html` — overview, searchable orders, status updates, products, stock, visibility, and payment event log. Use **Load example orders** to add three fictional orders.

All commerce data is browser-local. The admin is intentionally open with no authentication. The same browser acts as the demo customer and merchant. This is not suitable for real customer or payment data. No card details or OTPs are requested. Koko-style schedules are illustrative; there is no provider integration or real credit agreement.

Online/Koko simulations offer approval, decline, and cancel outcomes. Successful orders reduce stock and clear the bag. Failed and cancelled payments keep the bag. Cancelling an order restores its reserved stock once and records a simulated refund/cancellation event. COD can be marked collected on delivered orders. Order snapshots retain the price at purchase, independent of later catalogue changes.

The initial 18 styles use nine sample photographs, including illustrative variants. Logo artwork is rendered from the client PDF. See ASSETS.md for sources.

Validation: `node test-commerce.cjs` and `node verify.cjs`.

Edit files in `dist` directly. The historical `expand.cjs`, `storefront.cjs`, and `commerce-upgrade.cjs` scripts were one-time migrations and should not be rerun over the finished site.

Before production: add a server database, real authentication and authorization, server-side prices/stock validation, approved gateway integration and signed webhooks, privacy controls, confirmed product details, merchant policies, and deployment configuration.
