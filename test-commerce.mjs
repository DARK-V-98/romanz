// Ported from the original test-commerce.cjs. Run: npm test
import assert from 'node:assert/strict';
const data = new Map();
globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
const S = await import('./src/lib/store.js');

const customer = { name: 'Test Customer', email: 'test@example.com', address: '12 Example Lane', city: 'Colombo' };
const start = S.load();
assert.equal(start.products.length, 18);
assert.ok(start.orders.length > 40, 'sample orders seeded');
assert.deepEqual(S.load().orders.map(o => o.id), start.orders.map(o => o.id), 'sample data is deterministic');
for (const o of start.orders) assert.equal(o.total, o.lines.reduce((a, l) => a + l.price * l.qty, 0) + o.shipping);

const p = start.products[0], items = [{ id: p.id, option: p.options[0], qty: 2 }], n = start.orders.length;
assert.equal(S.quote(items).total, p.price * 2 + 350);
assert.equal(S.quote(items, 'collection').shipping, 0);
assert.throws(() => S.quote([{ ...items[0], qty: 11 }]));
assert.throws(() => S.quote([{ ...items[0], option: 'invalid' }]));

const order = S.place({ items, delivery: 'standard', method: 'online', customer, token: 'test-online' });
assert.equal(order.payment, 'Paid (mock)'); assert.equal(S.load().products[0].stock, p.stock - 2); assert.equal(S.load().orders.length, n + 1);
S.place({ items, delivery: 'standard', method: 'online', customer, token: 'test-online' });
assert.equal(S.load().orders.length, n + 1, 'idempotent'); assert.equal(S.load().products[0].stock, p.stock - 2);
S.attempt('online', 'Declined (mock)', 100, 'decline'); assert.equal(S.load().orders.length, n + 1);

S.updateOrder(order.id, 'Cancelled');
assert.equal(S.load().products[0].stock, p.stock); assert.equal(S.load().orders[0].payment, 'Refunded (mock)');
S.updateOrder(order.id, 'Cancelled'); assert.equal(S.load().products[0].stock, p.stock);
assert.throws(() => S.updateOrder(order.id, 'Processing'));

const cod = S.place({ items, delivery: 'collection', method: 'cod', customer, token: 'test-cod' });
assert.equal(cod.payment, 'Due on delivery'); assert.throws(() => S.updateOrder(cod.id, 'Processing', true));
S.updateOrder(cod.id, 'Delivered', true); assert.equal(S.load().orders[0].payment, 'Collected (mock)');

const koko = S.place({ items, delivery: 'standard', method: 'koko', customer, token: 'test-koko' });
assert.equal(koko.payment, 'Plan approved (mock)');
assert.equal(Math.round(koko.installments.reduce((a, b) => a + b, 0) * 100), Math.round(koko.total * 100));

S.product({ ...p, stock: 0 }); assert.throws(() => S.quote(items));
S.product({ ...p, stock: 10, active: false }); assert.throws(() => S.quote(items));
S.product({ name: 'Test piece', price: 5000, stock: 4, active: true, category: 'rings', image: p.image });
assert.equal(S.load().products.length, 19);
assert.throws(() => S.product({ name: 'Bad', price: -1, stock: 4, active: true, category: 'rings', image: p.image }));

S.sendMessage({ name: 'A', email: 'a@example.com', body: 'Hello' }); assert.equal(S.load().messages[0].read, false);
assert.throws(() => S.sendMessage({ name: '', email: 'x', body: '' }));
S.markRead(S.load().messages[0].id); assert.equal(S.load().messages[0].read, true);
assert.ok(S.customers().some(c => c.email === 'customer@romanz.lk' && c.orders > 0), 'demo customer has orders');

S.reset(); assert.equal(S.load().orders.length, n, 'reset restores sample data');
console.log('PASS: catalogue, seeded data, totals, quantities, variants, idempotency, stock, refunds, COD, installments, product editing, inbox, customers, reset.');
