// Mock commerce logic tests. Run: npm test
import assert from 'node:assert/strict';
const data = new Map();
globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
const S = await import('./src/lib/store.js');
const admin = { id: 'u1', name: 'Romana Perera', role: 'admin' }, manager = { id: 'u2', name: 'Chamari', role: 'manager' }, staff = { id: 'u3', name: 'Lahiru', role: 'staff' };
const customer = { name: 'Test Customer', email: 'Test@Example.com', phone: '077 555 1234', address: '12 Example Lane', city: 'Colombo' };
const pass = [];
const t = (name, fn) => { fn(); pass.push(name); };

const start = S.load();
t('seed', () => {
  assert.equal(start.products.length, 18);
  assert.ok(start.orders.length > 40);
  assert.deepEqual(S.load().orders.map(o => o.id), start.orders.map(o => o.id), 'deterministic');
  for (const o of start.orders) {
    assert.equal(o.total, o.lines.reduce((a, l) => a + l.price * l.qty, 0) + o.shipping - o.discount);
    assert.ok(o.events.length >= 1 && S.STATUSES.includes(o.status));
    if (['Shipped', 'Out for delivery'].includes(o.status)) assert.ok(o.shipment?.tracking, 'shipped seeds have tracking');
  }
  for (const p of start.products) assert.equal(p.stock, p.variants.reduce((a, v) => a + v.stock, 0));
});

const p = start.products[0], v = p.variants[0], items = [{ id: p.id, option: v.option, qty: 2 }];
t('quote', () => {
  assert.equal(S.quote(items).total, p.price * 2 + 350);
  assert.equal(S.quote(items, 'collection').shipping, 0);
  assert.throws(() => S.quote([{ ...items[0], qty: 11 }]));
  assert.throws(() => S.quote([{ ...items[0], option: 'invalid' }]));
  assert.throws(() => S.quote([{ ...items[0], qty: v.stock + 1 }]), /only/);
  const d = S.quote(items, 'standard', 'welcome10');
  assert.equal(d.discount, Math.round(p.price * 2 * 0.1)); assert.equal(d.code, 'WELCOME10');
  assert.throws(() => S.quote(items, 'standard', 'AVURUDU'), /isn’t valid/);
  assert.throws(() => S.quote(items, 'standard', 'NOPE'));
});

let online;
t('online checkout reserves stock and waits for the webhook', () => {
  const n = S.load().orders.length;
  online = S.place({ items, delivery: 'standard', method: 'online', customer, token: 'test-online' });
  assert.equal(online.status, 'Pending payment'); assert.equal(online.payment, 'Awaiting payment');
  assert.equal(online.customer.email, 'test@example.com');
  assert.match(online.id, /^RZ-\d+$/);
  assert.equal(S.load().products[0].variants[0].stock, v.stock - 2);
  S.place({ items, delivery: 'standard', method: 'online', customer, token: 'test-online' });
  assert.equal(S.load().orders.length, n + 1, 'idempotent');
  assert.equal(S.load().outbox.length, 0, 'no confirmation email before payment');
});

t('webhook: forged, declined, approved, duplicate', () => {
  assert.throws(() => S.payOrder(online.id, 'approved', true), /signature/);
  assert.equal(S.load().orders.find(o => o.id === online.id).status, 'Pending payment');
  assert.throws(() => S.webhook({ ...S.gatewayPayload(online, 'approved'), payhere_amount: '1.00' }), /signature|amount/);
  S.payOrder(online.id, 'declined');
  assert.equal(S.load().orders.find(o => o.id === online.id).status, 'Pending payment');
  const paid = S.payOrder(online.id, 'approved');
  assert.equal(paid.status, 'Confirmed'); assert.equal(paid.payment, 'Paid (mock)');
  assert.equal(S.load().outbox[0].channel, 'sms'); assert.ok(S.load().outbox.some(m => m.subject.includes(online.id)));
  S.payOrder(online.id, 'approved');
  assert.ok(S.load().transactions[0].outcome.includes('Duplicate'));
});

t('status machine and roles', () => {
  assert.throws(() => S.setStatus(online.id, 'Delivered', {}, staff), /can’t go/);
  assert.throws(() => S.setStatus(online.id, 'Cancelled', {}, staff), /manager/);
  S.setStatus(online.id, 'Packed', {}, staff);
  assert.throws(() => S.setStatus(online.id, 'Shipped', { courier: 'Domex' }, staff), /tracking/);
  const sh = S.setStatus(online.id, 'Shipped', { courier: 'Domex', tracking: 'LK123456' }, staff);
  assert.equal(sh.shipment.tracking, 'LK123456'); assert.ok(sh.shipment.url.includes('LK123456'));
  S.setStatus(online.id, 'Out for delivery', {}, staff);
  S.setStatus(online.id, 'Delivered', {}, staff);
  assert.throws(() => S.setStatus(online.id, 'Returned', {}, staff), /manager/);
  const stockBefore = S.load().products[0].variants[0].stock;
  const ret = S.setStatus(online.id, 'Returned', { note: 'Wrong size' }, manager);
  assert.equal(ret.payment, 'Refunded (mock)'); assert.equal(S.load().products[0].variants[0].stock, stockBefore + 2);
  assert.ok(S.publicEvents(ret).length >= 6);
  assert.equal(S.findOrder(online.id, 'TEST@example.com').id, online.id);
  assert.throws(() => S.findOrder(online.id, 'other@example.com'));
  assert.equal(S.orderByToken(online.id, ret.trackToken).id, online.id);
  assert.equal(S.orderByToken(online.id, 'wrong'), null);
});

t('expiry job returns stock', () => {
  const before = S.load().products[0].variants[0].stock;
  const o = S.place({ items: [{ ...items[0], qty: 1 }], delivery: 'standard', method: 'koko', customer, token: 'test-expire' });
  assert.equal(S.load().products[0].variants[0].stock, before - 1);
  assert.equal(S.expireUnpaid(Date.now()), 0);
  assert.equal(S.expireUnpaid(Date.now() + 31 * 60000), 1);
  assert.equal(S.load().orders.find(x => x.id === o.id).status, 'Cancelled');
  assert.equal(S.load().products[0].variants[0].stock, before);
  const late = S.payOrder(o.id, 'approved');
  assert.equal(late.status, 'Cancelled'); assert.ok(S.load().transactions[0].outcome.includes('auto-refunded'));
});

t('cash on delivery and collection', () => {
  const cod = S.place({ items: [{ ...items[0], qty: 1 }], delivery: 'collection', method: 'cod', customer, token: 'test-cod' });
  assert.equal(cod.status, 'Confirmed'); assert.equal(cod.payment, 'Due on delivery');
  assert.throws(() => S.collectCash(cod.id, staff));
  S.setStatus(cod.id, 'Packed', {}, staff);
  assert.ok(!S.nextStatuses(S.load().orders.find(o => o.id === cod.id), staff).includes('Shipped'), 'collection skips courier');
  S.setStatus(cod.id, 'Delivered', {}, staff);
  assert.equal(S.collectCash(cod.id, staff).payment, 'Collected (mock)');
  assert.equal(S.updateOrder(cod.id, 'Delivered').payment, 'Collected (mock)');
});

t('cancel restores stock once', () => {
  const before = S.load().products[0].variants[0].stock;
  const o = S.place({ items: [{ ...items[0], qty: 1 }], delivery: 'standard', method: 'cod', customer, token: 'test-cancel' });
  S.setStatus(o.id, 'Cancelled', {}, manager);
  assert.equal(S.load().products[0].variants[0].stock, before);
  assert.throws(() => S.setStatus(o.id, 'Confirmed', {}, admin));
});

t('product editor, variants, stock log, permissions', () => {
  const input = { name: 'Nova Ring', category: 'rings', price: 6900, compareAt: null, status: 'active', featured: false, images: ['ring.jpg'], description: '', finish: 'Gold tone', tag: '', variants: [{ sku: 'NOVA-US6', option: 'US 6', price: null, stock: 3 }, { sku: 'NOVA-US7', option: 'US 7', price: 7400, stock: 0 }] };
  assert.throws(() => S.saveProduct(input, staff), /managers/);
  const np = S.saveProduct(input, manager);
  assert.equal(np.stock, 3); assert.deepEqual(np.options, ['US 6', 'US 7']);
  assert.equal(S.priceOf(np, 'US 7'), 7400);
  assert.throws(() => S.quote([{ id: np.id, option: 'US 7', qty: 1 }]), /only 0/);
  assert.throws(() => S.saveProduct({ ...input, name: 'Other', variants: [{ sku: 'NOVA-US6', option: 'US 6', stock: 1 }] }, manager), /already used/);
  assert.throws(() => S.saveProduct({ ...input, images: [] }, manager), /photo/);
  assert.throws(() => S.saveProduct({ ...input, images: ['../../etc'] }, manager), /photo/);
  S.adjustStock(np.id, 'NOVA-US7', 5, 'restock', 'Delivery from workshop', manager);
  assert.equal(S.load().products.find(x => x.id === np.id).variants[1].stock, 5);
  assert.throws(() => S.adjustStock(np.id, 'NOVA-US7', -9, 'damaged', '', manager), /at most 5/);
  assert.ok(S.load().movements.some(m => m.sku === 'NOVA-US7' && m.delta === 5 && m.reason === 'restock'));
  const dup = S.duplicateProduct(np.id, manager);
  assert.equal(dup.status, 'draft'); assert.equal(dup.stock, 0);
  assert.throws(() => S.quote([{ id: dup.id, option: 'US 6', qty: 1 }]), /no longer available/);
  S.setProductStatus(np.id, 'archived', manager);
  assert.ok(!S.load().products.find(x => x.id === np.id).active);
  // legacy simple signature
  S.product({ ...p, stock: 0 }); assert.throws(() => S.quote(items));
  S.product({ ...p, stock: 10, active: false }); assert.throws(() => S.quote(items));
});

t('uploaded media', () => {
  assert.throws(() => S.saveMedia('data:text/html;base64,AAAA'));
  const ref = S.saveMedia('data:image/png;base64,iVBORw0KGgo=');
  assert.ok(S.img(ref).startsWith('data:image/png'));
  S.saveProduct({ name: 'Uploaded Piece', category: 'earrings', price: 3000, status: 'active', images: [ref], variants: [{ sku: 'UPL-PAIR', option: 'Pair', stock: 2 }] }, admin);
  assert.equal(S.mediaUsage().count, 1);
});

t('csv import', () => {
  const plan = S.planImport(S.CSV_TEMPLATE);
  assert.equal(plan.errors.length, 0); assert.equal(plan.items.length, 2);
  assert.equal(plan.items[0].input.variants.length, 2);
  const r = S.importProducts(S.CSV_TEMPLATE, manager);
  assert.equal(r.created, 2);
  const again = S.importProducts(S.CSV_TEMPLATE.replace('NOVASTACK-US6,4', 'NOVASTACK-US6,9'), manager);
  assert.equal(again.updated, 2); assert.equal(again.created, 0);
  assert.equal(S.load().products.find(x => x.name === 'Nova Stacking Ring').variants[0].stock, 9);
  assert.ok(S.planImport('name,category,price\nX,unknown,10').errors.length);
  assert.deepEqual(S.parseCSV('a,b\n"x, ""y""",2\n'), [{ a: 'x, "y"', b: '2' }]);
});

const q2 = start.products[2], one = { id: q2.id, option: q2.variants.find(x => x.stock > 1).option, qty: 1 };
t('discounts', () => {
  S.saveDiscount({ code: 'test5', type: 'fixed', value: 500, min: 0, maxUses: 1, active: true }, manager);
  const o = S.place({ items: [one], delivery: 'standard', method: 'cod', customer, token: 'test-disc', code: 'TEST5' });
  assert.equal(o.discount, 500);
  assert.throws(() => S.quote([one], 'standard', 'TEST5'), /fully used/);
  assert.throws(() => S.saveDiscount({ code: 'X', type: 'percent', value: 10, min: 0, maxUses: 0 }, manager));
});

t('settings drive shipping', () => {
  S.saveSettings({ shippingFee: 500, freeShippingOver: 1000 }, admin);
  assert.equal(S.quote([one]).shipping, 0);
  S.saveSettings({ freeShippingOver: 0 }, admin);
  assert.equal(S.quote([one]).shipping, 500);
  assert.throws(() => S.saveSettings({ couriers: [] }, admin));
});

t('accounts, reset and team', () => {
  assert.equal(S.authenticate('customer@romanz.lk', 'customer123').role, 'customer');
  assert.throws(() => S.authenticate('customer@romanz.lk', 'nope'));
  const u = S.register({ name: 'Test Customer', email: 'test@example.com', password: 'longenough' });
  assert.ok(S.load().orders.filter(o => o.customer.email === 'test@example.com').every(o => o.userId === u.id), 'guest orders linked');
  assert.throws(() => S.register({ name: 'X', email: 'test@example.com', password: 'longenough' }), /already/);
  S.requestReset('test@example.com');
  const code = S.load().outbox[0].body.match(/\d{6}/)[0];
  assert.throws(() => S.resetPassword('test@example.com', '000000', 'newpassword'));
  S.resetPassword('test@example.com', code, 'newpassword');
  assert.ok(S.authenticate('test@example.com', 'newpassword'));
  S.saveAddress(u.id, { label: 'Home', address: '1 Road', city: 'Galle' });
  assert.ok(S.load().users.find(x => x.id === u.id).addresses[0].isDefault);
  assert.throws(() => S.inviteMember({ name: 'New', email: 'new@romanz.lk', role: 'staff' }, manager), /administrators/);
  const pw = S.inviteMember({ name: 'New Staff', email: 'new@romanz.lk', role: 'staff' }, admin);
  assert.equal(S.authenticate('new@romanz.lk', pw).role, 'staff');
  const id = S.load().users.find(x => x.email === 'new@romanz.lk').id;
  S.setMember(id, { active: false }, admin);
  assert.throws(() => S.authenticate('new@romanz.lk', pw), /deactivated/);
  assert.throws(() => S.setMember('u1', { role: 'staff' }, admin), /own role/);
  assert.ok(S.load().audit.length > 5);
});

t('inbox and customers', () => {
  S.sendMessage({ name: 'A', email: 'a@example.com', body: 'Hello' }); assert.equal(S.load().messages[0].read, false);
  assert.throws(() => S.sendMessage({ name: '', email: 'x', body: '' }));
  S.replyMessage(S.load().messages[0].id, 'Hi back', manager);
  assert.equal(S.load().messages[0].replies.length, 1); assert.equal(S.load().outbox[0].to, 'a@example.com');
  assert.ok(S.customers().some(c => c.email === 'customer@romanz.lk' && c.orders > 0));
  assert.ok(S.lowStock().length > 0);
});


t('reviews: verified, moderation, rating', () => {
  const st = S.load(), o = st.orders.find(o => o.status === 'Delivered' && st.products.find(p => p.id === o.lines[0].id)?.active), pid = o.lines[0].id;
  assert.ok(st.reviews.length > 5 && st.reviews.some(r => r.status === 'pending'));
  assert.throws(() => S.submitReview({ productId: pid, rating: 6, body: 'Lovely piece really', name: 'A', email: 'a@x.com' }), /star/);
  const r = S.submitReview({ productId: pid, rating: 5, title: 'Great', body: 'Absolutely lovely piece', name: 'Fresh Buyer', email: 'fresh@example.com' });
  assert.equal(r.status, 'pending'); assert.equal(r.verified, false);
  assert.throws(() => S.submitReview({ productId: pid, rating: 4, body: 'Second review here', name: 'Fresh Buyer', email: 'fresh@example.com' }), /already/);
  const before = S.ratingOf(S.load(), pid).count;
  assert.throws(() => S.moderateReview(r.id, 'published', staff), /managers/);
  S.moderateReview(r.id, 'published', manager);
  assert.equal(S.ratingOf(S.load(), pid).count, before + 1);
  S.replyReview(r.id, 'Thank you!', manager); assert.equal(S.load().outbox[0].to, 'fresh@example.com');
  const buyer = S.load().orders.find(x => x.status === 'Delivered' && S.load().products.find(p => p.id === x.lines[0].id)?.active && !S.load().reviews.some(r => r.email === x.customer.email && r.productId === x.lines[0].id));
  assert.equal(S.submitReview({ productId: buyer.lines[0].id, rating: 4, body: 'Bought and loved it', name: buyer.customer.name, email: buyer.customer.email.toUpperCase() }).verified, true, 'verified buyer');
  assert.ok(S.load().notices.some(n => n.type === 'review'));
});

t('wishlist and recently viewed', () => {
  S.toggleWish('luna-hoops'); S.toggleWish('aurora-ring');
  assert.deepEqual(S.wishlist(null), ['aurora-ring', 'luna-hoops']);
  S.toggleWish('luna-hoops'); assert.deepEqual(S.wishlist(null), ['aurora-ring']);
  S.mergeGuestWishlist('u4');
  assert.deepEqual(S.wishlist(null), []); assert.ok(S.wishlist('u4').includes('aurora-ring'));
  S.toggleWish('aurora-ring', 'u4'); assert.ok(!S.wishlist('u4').includes('aurora-ring'));
  S.markViewed('a'); S.markViewed('b'); S.markViewed('a'); assert.deepEqual(S.recentlyViewed().slice(0, 2), ['a', 'b']);
});

t('back-in-stock alerts fire once on restock', () => {
  const p = S.load().products.find(p => p.id === 'aurora-rose'), v = p.variants[2];
  assert.equal(v.stock, 0);
  assert.equal(S.subscribeAlert(p.id, v.option, 'wait@example.com'), true);
  assert.equal(S.subscribeAlert(p.id, v.option, 'wait@example.com'), false, 'dedup');
  assert.throws(() => S.subscribeAlert('luna-bold', 'Pair', 'x@example.com'), /in stock/);
  const sent = S.load().outbox.length;
  S.adjustStock(p.id, v.sku, 3, 'restock', '', manager);
  const mails = S.load().outbox.slice(0, S.load().outbox.length - sent);
  assert.ok(mails.some(m => m.to === 'wait@example.com' && m.subject.includes('back in stock')));
  S.adjustStock(p.id, v.sku, 1, 'restock', '', manager);
  assert.equal(S.load().outbox.filter(m => m.to === 'wait@example.com' && m.subject.includes('back in stock')).length, 1);
});

t('returns: partial refund, exchange, rules', () => {
  const p1 = S.load().products.find(p => p.id === 'golden-hour'), p2 = S.load().products.find(p => p.id === 'link-bracelet');
  const cust = { name: 'Ret Urner', email: 'ret@example.com', address: '1 Lane', city: 'Galle' };
  const o = S.place({ items: [{ id: p1.id, option: '40 cm', qty: 2 }, { id: p2.id, option: '16 cm', qty: 1 }], delivery: 'standard', method: 'cod', customer: cust, token: 'ret-1' });
  assert.equal(S.returnWindow(S.load().orders.find(x => x.id === o.id)).ok, false);
  for (const st of ['Packed']) S.setStatus(o.id, st, {}, staff);
  S.setStatus(o.id, 'Shipped', { courier: 'Domex', tracking: 'LK555000' }, staff);
  S.courierScan(o.id, 'hub'); S.courierScan(o.id, 'out'); S.courierScan(o.id, 'failed');
  assert.equal(S.load().orders.find(x => x.id === o.id).status, 'Shipped');
  S.courierScan(o.id, 'delivered');
  const hoops = S.load().orders.find(x => x.id === o.id).lines.find(l => l.id === p1.id);
  assert.throws(() => S.requestReturn({ orderId: o.id, email: 'other@example.com', items: [{ sku: hoops.sku, qty: 1 }], reason: 'Changed my mind' }), /not found/);
  assert.throws(() => S.requestReturn({ orderId: o.id, email: cust.email, items: [{ sku: hoops.sku, qty: 3 }], reason: 'Changed my mind' }), /at most 2/);
  const r = S.requestReturn({ orderId: o.id, email: cust.email, items: [{ sku: hoops.sku, qty: 1 }], reason: 'Changed my mind' });
  assert.throws(() => S.requestReturn({ orderId: o.id, email: cust.email, items: [{ sku: hoops.sku, qty: 1 }], reason: 'x' }), /in progress/);
  assert.throws(() => S.receiveReturn(r.id, staff), /approved/);
  assert.throws(() => S.decideReturn(r.id, 'approved', '', staff), /managers/);
  assert.throws(() => S.decideReturn(r.id, 'rejected', '', manager), /reason/);
  S.decideReturn(r.id, 'approved', '', manager);
  const stock = S.load().products.find(p => p.id === p1.id).variants[0].stock;
  const done = S.receiveReturn(r.id, staff);
  assert.equal(done.refund, hoops.price);
  const after = S.load().orders.find(x => x.id === o.id);
  assert.equal(after.payment, 'Partially refunded (mock)'); assert.equal(after.status, 'Delivered');
  assert.equal(S.load().products.find(p => p.id === p1.id).variants[0].stock, stock + 1);
  // exchange the bracelet for another length
  const br = after.lines.find(l => l.id === p2.id);
  const x = S.requestReturn({ orderId: o.id, email: cust.email, type: 'exchange', items: [{ sku: br.sku, qty: 1, toOption: '18 cm' }], reason: 'Wrong size' });
  S.decideReturn(x.id, 'approved', '', manager);
  const ex = S.receiveReturn(x.id, staff);
  const rep = S.load().orders.find(z => z.id === ex.exchangeOrderId);
  assert.equal(rep.total, 0); assert.equal(rep.lines[0].option, '18 cm'); assert.equal(rep.status, 'Confirmed');
  // returning the last hoop closes the order as Returned
  const last = S.requestReturn({ orderId: o.id, email: cust.email, items: [{ sku: hoops.sku, qty: 1 }], reason: 'Gift not needed' });
  S.decideReturn(last.id, 'approved', '', manager); S.receiveReturn(last.id, staff);
  assert.equal(S.load().orders.find(z => z.id === o.id).payment, 'Partially refunded (mock)', 'bracelet was exchanged, not refunded');
});

t('auto courier and notices', () => {
  const cust = { name: 'Auto', email: 'auto@example.com', address: '1 Lane', city: 'Kandy' };
  const o = S.place({ items: [{ id: 'luna-bold', option: 'Pair', qty: 1 }], delivery: 'standard', method: 'cod', customer: cust, token: 'auto-1' });
  S.setStatus(o.id, 'Packed', {}, staff); S.setStatus(o.id, 'Shipped', { courier: 'Pronto', tracking: 'PR123456' }, staff);
  assert.equal(S.courierTick(Date.now() + 60000), 0, 'off by default');
  S.saveSettings({ autoCourier: true }, admin);
  for (let i = 0; i < 3; i++) S.courierTick(Date.now() + 60000 * (i + 1));
  assert.equal(S.load().orders.find(x => x.id === o.id).status, 'Delivered');
  const n = S.load().notices; assert.ok(n.some(x => x.type === 'order'));
  S.markNotices('u1'); assert.ok(S.load().notices.every(x => x.readBy.includes('u1')));
});

t('v4 data is migrated, not wiped', () => {
  const cur = S.load(); const old = { ...cur, version: 4 }; delete old.reviews; delete old.alerts; delete old.returns; delete old.notices;
  old.settings = { ...cur.settings }; delete old.settings.returnDays; old.users = cur.users.map(({ wishlist, ...u }) => u);
  S.reset(); localStorage.setItem('romanz-demo-store-v4', JSON.stringify(old));
  const m = S.load();
  assert.equal(m.version, 5); assert.equal(m.orders.length, cur.orders.length, 'orders kept');
  assert.deepEqual(m.reviews, []); assert.equal(m.settings.returnDays, 14); assert.ok(m.users.every(u => Array.isArray(u.wishlist)));
});

t('reset', () => {
  S.reset(); assert.equal(S.load().orders.length, start.orders.length); assert.equal(S.mediaUsage().count, 0);
});
console.log('PASS (' + pass.length + '): ' + pass.join(', '));
