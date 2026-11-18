/* Local-only commerce simulator. It stands in for the database, the /api functions and the payment
   webhook described in docs/BACKEND_PLAN.md, so every flow can be clicked through before the real
   backend exists. Everything lives in this browser's localStorage. It is never a payment or
   authentication service: passwords and the "merchant secret" below are public demo values. */
import { PRODUCTS } from './catalog.js';

const KEY = 'romanz-demo-store-v4', BAG = 'romanz-bag-v1', MEDIA = 'romanz-media-v1', WISH = 'romanz-wish-v1', SEEN = 'romanz-seen-v1', EVT = 'romanz:change';
const clone = x => JSON.parse(JSON.stringify(x));
const nowIso = () => new Date().toISOString();

export const DEFAULT_CATEGORIES = [['rings', 'Rings'], ['necklaces', 'Necklaces'], ['earrings', 'Earrings'], ['bracelets', 'Bracelets'], ['sets', 'Occasion sets']].map(([slug, name]) => ({ slug, name, active: true }));
export const CATEGORIES = DEFAULT_CATEGORIES.map(c => c.slug);
export const OPTION_PRESETS = { rings: ['US 5', 'US 6', 'US 7', 'US 8', 'US 9'], necklaces: ['40 cm', '45 cm'], earrings: ['Pair'], bracelets: ['16 cm', '18 cm', '20 cm'], sets: ['Necklace + earrings'] };
export const STATUSES = ['Pending payment', 'Confirmed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled', 'Returned'];
export const FLOW = ['Confirmed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered'];
export const COLLECTION_FLOW = ['Confirmed', 'Packed', 'Delivered'];
export const PRODUCT_STATUSES = ['draft', 'active', 'archived'];
export const MOVEMENT_REASONS = ['restock', 'adjustment', 'damaged', 'order', 'cancel', 'return'];
export const SHIPPING = 350;
export const SYSTEM = { id: 'system', name: 'System', role: 'system' };

const DEFAULT_COURIERS = [
  { name: 'Domex', url: 'https://tracking.example/domex/{n}' },
  { name: 'Pronto', url: 'https://tracking.example/pronto/{n}' },
  { name: 'Koombiyo', url: 'https://tracking.example/koombiyo/{n}' },
  { name: 'Prompt Xpress', url: 'https://tracking.example/promptxpress/{n}' },
  { name: 'Studio rider', url: '' }
];
export const DEMO_USERS = [
  { id: 'u1', name: 'Romana Perera', email: 'admin@romanz.lk', password: 'admin123', role: 'admin', title: 'Founder & creative director' },
  { id: 'u2', name: 'Chamari Weerasinghe', email: 'manager@romanz.lk', password: 'manager123', role: 'manager', title: 'Store manager' },
  { id: 'u3', name: 'Lahiru Dissanayake', email: 'staff@romanz.lk', password: 'staff123', role: 'staff', title: 'Packing & dispatch' },
  { id: 'u4', name: 'Demo Customer', email: 'customer@romanz.lk', password: 'customer123', role: 'customer', title: 'ROMANZ Circle member', phone: '077 123 4567', addresses: [{ id: 'a1', label: 'Home', address: '24 Sample Lane', city: 'Colombo 07', phone: '077 123 4567', isDefault: true }] }
];

// Mock payment gateway. A real gateway keeps the secret on the server; here it only exists so the
// signed-webhook check can be demonstrated (and a forged webhook can be shown being rejected).
export const MERCHANT = { id: '1200000 (sandbox)', secret: 'romanz-demo-merchant-secret' };
const RANK = { customer: 0, staff: 1, manager: 2, admin: 3, system: 4 };
const atLeast = (actor, role) => RANK[actor?.role] >= RANK[role];

/* ---------------------------------------------------------------- catalogue seed */
const base = clone(PRODUCTS);
const extra = [['luna-petite', 'Luna Petite Hoops', 'luna-hoops', 3900], ['luna-bold', 'Luna Bold Hoops', 'luna-hoops', 6900], ['aurora-rose', 'Aurora Rose Edition', 'aurora-ring', 13900], ['celeste-promise', 'Celeste Promise Ring', 'emerald-cut', 9900], ['link-mini', 'Petite Link Bracelet', 'link-bracelet', 4900], ['link-bold', 'Statement Link Bracelet', 'link-bracelet', 8900], ['golden-charms', 'Golden Charms Necklace', 'golden-hour', 8900], ['heritage-evening', 'Heritage Evening Set', 'heritage-set', 21900], ['royal-celebration', 'Royal Celebration Set', 'occasion-set', 34900]];
for (const [id, name, source, price] of extra) {
  const p = clone(base.find(p => p.id === source));
  Object.assign(p, { id, name, price, tag: 'New sample style', description: p.description + ' Illustrative sample variant; photography is shared with its collection.' });
  base.push(p);
}
export const IMAGES = [...new Set(base.map(p => p.image))];
const skuFor = (id, option) => (id.replace(/[^a-z0-9]/gi, '').slice(0, 8) + '-' + option.replace(/[^a-z0-9]/gi, '').slice(0, 6)).toUpperCase();

// Derived fields keep the storefront simple: image = cover photo, options = sellable sizes, stock = total.
export function derive(p) {
  p.image = p.images[0];
  p.options = p.variants.filter(v => v.active).map(v => v.option);
  p.stock = p.variants.filter(v => v.active).reduce((a, v) => a + v.stock, 0);
  p.active = p.status === 'active';
  return p;
}
const defaults = base.map((p, i) => derive({
  id: p.id, name: p.name, category: p.category, description: p.description, finish: p.finish, tag: p.tag,
  price: p.price, compareAt: null, status: 'active', featured: i < 4, images: [p.image],
  variants: p.options.map((option, j) => ({ sku: skuFor(p.id, option), option, price: null, stock: i === 11 ? 0 : i === 3 && j === 0 ? 1 : 2 + (i * 3 + j * 5) % 7, low: 2, active: true })),
  createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString()
}));

/* ---------------------------------------------------------------- deterministic sample data */
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const PEOPLE = [['Demo Customer', 'customer@romanz.lk', 'Colombo 07', '077 123 4567'], ['Amaya Silva', 'amaya@example.com', 'Kandy', '071 555 0101'], ['Nimal Perera', 'nimal@example.com', 'Galle', '070 555 0102'], ['Sara Fernando', 'sara@example.com', 'Negombo', '076 555 0103'], ['Dilini Jayasuriya', 'dilini@example.com', 'Colombo 03', '077 555 0104'], ['Kavindu Rajapaksha', 'kavindu@example.com', 'Kurunegala', '072 555 0105'], ['Ishara Wickramasinghe', 'ishara@example.com', 'Matara', '078 555 0106'], ['Tharushi Gunawardena', 'tharushi@example.com', 'Colombo 05', '075 555 0107'], ['Ravindu Bandara', 'ravindu@example.com', 'Jaffna', '077 555 0108'], ['Nethmi Senanayake', 'nethmi@example.com', 'Nugegoda', '071 555 0109'], ['Shehan de Mel', 'shehan@example.com', 'Moratuwa', '070 555 0110'], ['Ayesha Rahman', 'ayesha@example.com', 'Dehiwala', '076 555 0111']];
export function paymentFor(method, status) {
  if (status === 'Pending payment') return 'Awaiting payment';
  if (status === 'Cancelled' || status === 'Returned') return method === 'cod' && status === 'Cancelled' ? 'Cancelled' : 'Refunded (mock)';
  if (method === 'cod') return status === 'Delivered' ? 'Collected (mock)' : 'Due on delivery';
  return method === 'koko' ? 'Plan approved (mock)' : 'Paid (mock)';
}
const STATUS_TEXT = {
  'Pending payment': 'Order created, waiting for payment',
  Confirmed: 'Order confirmed',
  Packed: 'Packed and gift wrapped',
  Shipped: 'Handed to the courier',
  'Out for delivery': 'Out for delivery today',
  Delivered: 'Delivered',
  Cancelled: 'Order cancelled',
  Returned: 'Return received'
};
const ev = (date, status, text, by = 'System', visible = true) => ({ date, status, text: text || STATUS_TEXT[status], by, visible });
const trackingUrl = (couriers, name, n) => { const c = couriers.find(c => c.name === name); return c?.url ? c.url.replace('{n}', encodeURIComponent(n)) : ''; };

function sampleState() {
  const r = rng(20261118), now = Date.now(), orders = [], transactions = [], movements = [];
  for (let i = 0; i < 64; i++) {
    const age = Math.floor(r() * 90), person = PEOPLE[i % 7 === 0 ? 0 : Math.floor(r() * PEOPLE.length)];
    const picks = [defaults[Math.floor(r() * defaults.length)]];
    if (r() > 0.7) picks.push(defaults[Math.floor(r() * defaults.length)]);
    const lines = picks.map(p => ({ id: p.id, sku: p.variants[0].sku, name: p.name, image: p.image, option: p.variants[0].option, price: p.price, qty: r() > 0.85 ? 2 : 1 }));
    const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0), delivery = r() > 0.8 ? 'collection' : 'standard', shipping = delivery === 'standard' ? SHIPPING : 0, total = subtotal + shipping;
    const method = ['online', 'online', 'cod', 'koko'][Math.floor(r() * 4)];
    const roll = r();
    let status = roll < 0.06 ? 'Cancelled' : roll < 0.09 && age > 12 ? 'Returned' : age > 9 ? 'Delivered' : age > 4 ? 'Shipped' : age > 3 ? 'Out for delivery' : age > 1 ? 'Packed' : 'Confirmed';
    if (delivery === 'collection' && (status === 'Shipped' || status === 'Out for delivery')) status = 'Packed';
    const t0 = now - age * 86400000 - Math.floor(r() * 86400000), at = h => new Date(t0 + h * 3600e3).toISOString(), date = at(0);
    const id = 'RZ-' + (10480 + i), courier = DEFAULT_COURIERS[i % 4].name, tracking = 'LK' + (700000000 + Math.floor(r() * 99999999));
    const events = [ev(date, 'Confirmed', method === 'cod' ? 'Order confirmed · cash on delivery' : 'Order confirmed · payment received')];
    const path = delivery === 'collection' ? COLLECTION_FLOW : FLOW, reach = ['Cancelled'].includes(status) ? 1 : status === 'Returned' ? path.length : path.indexOf(status) + 1;
    path.slice(1, reach).forEach((s, k) => events.push(ev(at(18 + k * 26), s, s === 'Shipped' ? `Shipped with ${courier} · ${tracking}` : delivery === 'collection' && s === 'Delivered' ? 'Collected from the studio' : null, 'Lahiru Dissanayake')));
    if (status === 'Cancelled') events.push(ev(at(5), 'Cancelled', 'Cancelled at the customer’s request', 'Chamari Weerasinghe'));
    if (status === 'Returned') events.push(ev(at(24 * 8), 'Returned', 'Returned within 14 days · refunded', 'Chamari Weerasinghe'));
    const shipped = events.some(e => e.status === 'Shipped');
    const o = {
      id, token: 'seed-' + i, trackToken: 'trk' + (100000 + i * 7919).toString(36), date, lines, subtotal, discount: 0, code: null, shipping, total, delivery, method,
      customer: { name: person[0], email: person[1], phone: person[3], address: (12 + i) + ' Sample Lane', city: person[2] }, userId: person[1] === 'customer@romanz.lk' ? 'u4' : null,
      note: '', status, payment: paymentFor(method, status), source: 'seed', reserved: false, installments: method === 'koko' ? installment(total) : null, expiresAt: null,
      shipment: shipped ? { courier, tracking, url: trackingUrl(DEFAULT_COURIERS, courier, tracking), date: events.find(e => e.status === 'Shipped').date } : null,
      events: events.reverse(), notes: []
    };
    orders.push(o);
    transactions.push({ id: 'TX-S' + (5000 + i), date, method, outcome: method === 'cod' ? 'Awaiting cash' : 'Approved (mock)', total, orderId: o.id, source: method === 'cod' ? 'checkout' : 'webhook', verified: method !== 'cod' });
    if (o.payment !== paymentFor(method, 'Confirmed')) transactions.push({ id: 'TX-S' + (6000 + i), date: o.events[0].date, method, outcome: o.payment, total, orderId: o.id, source: 'studio' });
    for (const l of lines) movements.push({ id: 'MV-S' + (7000 + movements.length), date, productId: l.id, sku: l.sku, option: l.option, delta: -l.qty, reason: 'order', orderId: o.id, by: 'Checkout', note: '' });
  }
  defaults.forEach((p, i) => p.variants.forEach(v => movements.push({ id: 'MV-I' + i + v.sku, date: new Date(now - 95 * 86400000).toISOString(), productId: p.id, sku: v.sku, option: v.option, delta: v.stock, reason: 'restock', orderId: null, by: 'Romana Perera', note: 'Opening stock (sample)' })));
  orders.sort((a, b) => b.date.localeCompare(a.date)); transactions.sort((a, b) => b.date.localeCompare(a.date)); movements.sort((a, b) => b.date.localeCompare(a.date));
  const messages = [
    { id: 'MSG-1', date: new Date(now - 3600e3 * 5).toISOString(), name: 'Amaya Silva', email: 'amaya@example.com', topic: 'Sizing', body: 'Hi! Is the Aurora Halo Ring available in a US 4.5? Asking for a surprise proposal 💍', read: false, replies: [], orderId: null },
    { id: 'MSG-2', date: new Date(now - 3600e3 * 30).toISOString(), name: 'Kavindu Rajapaksha', email: 'kavindu@example.com', topic: 'Gifting', body: 'Can you add a handwritten note to an order going to Kandy? It is for my mother’s birthday.', read: false, replies: [], orderId: null },
    { id: 'MSG-3', date: new Date(now - 3600e3 * 72).toISOString(), name: 'Nethmi Senanayake', email: 'nethmi@example.com', topic: 'Care', body: 'What is the best way to store gold-tone pieces during the monsoon? Mine went a little dull.', read: true, replies: [], orderId: null }
  ];
  const discounts = [
    { code: 'WELCOME10', type: 'percent', value: 10, min: 0, maxUses: 0, uses: 4, active: true, endsAt: null },
    { code: 'GIFT1500', type: 'fixed', value: 1500, min: 10000, maxUses: 50, uses: 12, active: true, endsAt: null },
    { code: 'AVURUDU', type: 'percent', value: 15, min: 5000, maxUses: 0, uses: 31, active: false, endsAt: '2026-04-30' }
  ];
  return {
    version: 5, seq: 10544, products: clone(defaults), categories: clone(DEFAULT_CATEGORIES), orders, transactions, movements, messages, discounts,
    users: clone(DEMO_USERS).map(u => ({ phone: '', addresses: [], wishlist: [], active: true, createdAt: '2024-03-01T00:00:00.000Z', ...u })),
    outbox: [], audit: [], ...V5_FIELDS(orders),
    settings: { announcement: 'Complimentary gift wrapping on every order · Island-wide delivery', supportEmail: 'hello@romanz.lk', supportPhone: '077 000 0000', shippingFee: SHIPPING, freeShippingOver: 0, reservationMinutes: 30, couriers: clone(DEFAULT_COURIERS), ...V5_SETTINGS }
  };
}

/* v5 additions: reviews, back-in-stock alerts, return requests and the studio notification feed. */
const V5_SETTINGS = { returnDays: 14, autoCourier: false };
const REVIEW_TEXT = [
  [5, 'Even prettier in person', 'The finish catches the light beautifully and the gift box was gorgeous.'],
  [5, 'My everyday piece now', 'Comfortable enough to wear all day. Already planning my next order.'],
  [4, 'Lovely, runs slightly small', 'Beautiful detail. I’d suggest going half a size up for rings.'],
  [5, 'Perfect gift', 'Bought it for my sister’s birthday and she hasn’t taken it off.'],
  [4, 'Great quality for the price', 'Delivery to Kandy took three days, well packed.'],
  [3, 'Nice but delicate', 'Pretty piece. The chain is finer than I expected from the photos.']
];
function V5_FIELDS(orders) {
  const reviews = [];
  orders.filter(o => o.status === 'Delivered').slice(0, 18).forEach((o, i) => {
    const l = o.lines[0], [rating, title, body] = REVIEW_TEXT[i % REVIEW_TEXT.length];
    if (reviews.some(r => r.productId === l.id && r.email === o.customer.email)) return;
    reviews.push({ id: 'RV-S' + (100 + i), productId: l.id, email: o.customer.email, name: o.customer.name.split(' ')[0] + ' ' + o.customer.name.split(' ').slice(-1)[0][0] + '.', rating, title, body, date: new Date(new Date(o.date).getTime() + 6 * 86400000).toISOString(), status: i === 2 ? 'pending' : 'published', verified: true, reply: i === 0 ? { by: 'Romana Perera', body: 'Thank you so much! Enjoy wearing it.', date: o.date } : null });
  });
  return {
    reviews,
    alerts: [{ id: 'AL-S1', productId: 'aurora-rose', sku: 'AURORARO-US6', option: 'US 6', email: 'sara@example.com', date: orders[3].date, notified: null }, { id: 'AL-S2', productId: 'aurora-rose', sku: 'AURORARO-US7', option: 'US 7', email: 'nimal@example.com', date: orders[5].date, notified: null }],
    returns: [], notices: []
  };
}
function migrate(v) {
  if (v?.version !== 4) return v;
  return { ...v, version: 5, reviews: [], alerts: [], returns: [], notices: [], settings: { ...V5_SETTINGS, ...v.settings }, users: v.users.map(u => ({ wishlist: [], ...u })) };
}

/* ---------------------------------------------------------------- persistence */
const isState = v => v && v.version === 5 && ['products', 'orders', 'transactions', 'messages', 'users'].every(k => Array.isArray(v[k]));
let cache = null;
export function load() {
  if (!cache) { try { const v = JSON.parse(localStorage.getItem(KEY)); const m = migrate(v); cache = isState(m) ? m : sampleState(); } catch { cache = sampleState(); } }
  return clone(cache);
}
function save(s) {
  fireAlerts(s);
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { throw Error('This browser’s demo storage is full. Remove some uploaded photos or reset the demo data.'); }
  cache = s; emit();
}
let mediaCache = null;
const media = () => { if (!mediaCache) { try { mediaCache = JSON.parse(localStorage.getItem(MEDIA) || '{}'); } catch { mediaCache = {}; } } return mediaCache; };
const emit = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT)); };
export const subscribe = fn => {
  const ext = () => { cache = null; mediaCache = null; fn(); };
  window.addEventListener(EVT, fn); window.addEventListener('storage', ext);
  return () => { window.removeEventListener(EVT, fn); window.removeEventListener('storage', ext); };
};
export function reset() { [KEY, BAG, MEDIA, WISH, SEEN].forEach(k => localStorage.removeItem(k)); cache = null; mediaCache = null; emit(); }

export const money = n => 'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const uid = prefix => prefix + '-' + globalThis.crypto.randomUUID().slice(0, 8).toUpperCase();
export const img = path => !path ? '/logo.png' : path.startsWith('media:') ? (media()[path.slice(6)] || '/logo.png') : /^(https?:|data:)/.test(path) ? path : '/' + path;
const actorName = a => a?.name || 'System';
function audit(s, actor, action, detail) { s.audit.unshift({ id: uid('AU'), date: nowIso(), by: actorName(actor), role: actor?.role || 'system', action, detail }); s.audit.length = Math.min(s.audit.length, 400); }
function notify(s, { to, phone, subject, body, orderId = null }) {
  s.outbox.unshift({ id: uid('EM'), date: nowIso(), channel: 'email', to, subject, body, orderId });
  if (phone) s.outbox.unshift({ id: uid('SMS'), date: nowIso(), channel: 'sms', to: phone, subject: 'SMS', body: 'ROMANZ: ' + subject + (orderId ? ' (' + orderId + ')' : ''), orderId });
  s.outbox.length = Math.min(s.outbox.length, 300);
}
export const trackLink = o => '/track/' + o.id + '?t=' + o.trackToken;

/* ---------------------------------------------------------------- uploaded media (stands in for the storage bucket) */
export function saveMedia(dataUrl) {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) throw Error('Only JPG, PNG or WebP images can be uploaded.');
  if (dataUrl.length > 1_500_000) throw Error('That image is still too large after resizing.');
  const m = { ...media() }, id = globalThis.crypto.randomUUID().slice(0, 12);
  m[id] = dataUrl;
  try { localStorage.setItem(MEDIA, JSON.stringify(m)); } catch { throw Error('Demo photo storage is full (browser limit ≈ 5 MB). Remove unused photos or reset demo data.'); }
  mediaCache = m; return 'media:' + id;
}
function gcMedia(s) {
  const used = new Set([...s.products.flatMap(p => p.images), ...s.orders.flatMap(o => o.lines.map(l => l.image))].filter(p => p?.startsWith('media:')).map(p => p.slice(6)));
  const m = media(), keep = Object.fromEntries(Object.entries(m).filter(([k]) => used.has(k)));
  if (Object.keys(keep).length !== Object.keys(m).length) { localStorage.setItem(MEDIA, JSON.stringify(keep)); mediaCache = keep; }
}
export const mediaUsage = () => { const n = Object.keys(media()).length; let bytes = 0; for (const v of Object.values(media())) bytes += v.length; return { count: n, kb: Math.round(bytes / 1024) }; };
const validImage = (s, p) => IMAGES.includes(p) || (p.startsWith('media:') && media()[p.slice(6)]) || /^https:\/\/\S+$/.test(p);

/* ---------------------------------------------------------------- bag */
export function cart() { try { const b = JSON.parse(localStorage.getItem(BAG) || '[]'); return Array.isArray(b) ? b : []; } catch { return []; } }
export function setCart(items) { localStorage.setItem(BAG, JSON.stringify(items)); emit(); }
export function addToCart(id, option, qty = 1) {
  const b = cart(), line = b.find(i => i.id === id && i.option === option);
  if (line) line.qty = Math.min(10, line.qty + qty); else b.push({ id, option, qty });
  setCart(b);
}
export const variantOf = (p, option) => p?.variants.find(v => v.option === option && v.active);
export const priceOf = (p, option) => variantOf(p, option)?.price ?? p.price;

/* ---------------------------------------------------------------- pricing (stands in for POST /api/quote) */
function findDiscount(s, code, subtotal) {
  if (!code) return null;
  const d = s.discounts.find(d => d.code === String(code).trim().toUpperCase());
  if (!d || !d.active) throw Error('That code isn’t valid.');
  if (d.endsAt && new Date(d.endsAt + 'T23:59:59') < new Date()) throw Error('That code has expired.');
  if (d.maxUses && d.uses >= d.maxUses) throw Error('That code has been fully used.');
  if (subtotal < d.min) throw Error(`That code needs a subtotal of ${money(d.min)} or more.`);
  return { code: d.code, amount: Math.min(subtotal, d.type === 'percent' ? Math.round(subtotal * d.value / 100) : d.value) };
}
export function quote(items, delivery = 'standard', code = '', state) {
  const s = state || load(); if (!Array.isArray(items) || !items.length) throw Error('Your bag is empty.');
  let subtotal = 0; const totals = {};
  const lines = items.map(i => {
    const p = s.products.find(p => p.id === i.id);
    if (!p || p.status !== 'active') throw Error('A piece is no longer available. Please update your bag.');
    const v = variantOf(p, i.option);
    if (!v || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 10) throw Error('Please check your bag quantities and sizes.');
    totals[v.sku] = (totals[v.sku] || 0) + i.qty; const price = v.price ?? p.price; subtotal += price * i.qty;
    return { id: p.id, sku: v.sku, name: p.name, image: p.image, option: v.option, price, qty: i.qty };
  });
  for (const [sku, n] of Object.entries(totals)) { const l = lines.find(l => l.sku === sku), v = variantOf(s.products.find(p => p.id === l.id), l.option); if (n > v.stock) throw Error(`${l.name} (${l.option}): only ${v.stock} available.`); }
  if (!['standard', 'collection'].includes(delivery)) throw Error('Choose a delivery option.');
  const d = findDiscount(s, code, subtotal), discount = d?.amount || 0;
  const fee = s.settings.shippingFee, free = s.settings.freeShippingOver && subtotal - discount >= s.settings.freeShippingOver;
  const shipping = delivery === 'standard' && !free ? fee : 0;
  return { lines, subtotal, discount, code: d?.code || null, shipping, total: subtotal - discount + shipping, delivery };
}
export function installment(total) { const cents = Math.round(total * 100), part = Math.floor(cents / 3); return [part / 100, part / 100, (cents - 2 * part) / 100]; }

function moveStock(s, line, delta, reason, orderId, by, note = '') {
  const p = s.products.find(p => p.id === line.id), v = p?.variants.find(v => v.sku === line.sku);
  if (!v) return;
  v.stock = Math.max(0, v.stock + delta); derive(p);
  s.movements.unshift({ id: uid('MV'), date: nowIso(), productId: p.id, sku: v.sku, option: v.option, delta, reason, orderId, by, note });
}

/* ---------------------------------------------------------------- checkout (stands in for POST /api/checkout + place_order()) */
export function place({ items, delivery, method, customer, token, code = '', note = '', userId = null }) {
  if (!['online', 'cod', 'koko'].includes(method)) throw Error('Choose a payment method.');
  if (!token) throw Error('Checkout reference is missing. Please reload.');
  const s = load(), existing = s.orders.find(o => o.token === token); if (existing) return clone(existing);
  const q = quote(items, delivery, code, s);
  if (!customer || !customer.name?.trim() || !/^\S+@\S+\.\S+$/.test(customer.email?.trim() || '') || !customer.address?.trim()) throw Error('Please add your name, a valid email and your address.');
  if (customer.phone && !/^[0-9 +()-]{9,16}$/.test(customer.phone)) throw Error('Please check your phone number.');
  const email = customer.email.trim().toLowerCase(), date = nowIso(), pending = method !== 'cod';
  const linked = userId || s.users.find(u => u.email === email && u.role === 'customer')?.id || null;
  const order = {
    id: 'RZ-' + s.seq++, token, trackToken: 'trk' + globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10), date, ...q, method,
    customer: { name: customer.name.trim().slice(0, 80), email: email.slice(0, 120), phone: String(customer.phone || '').trim().slice(0, 16), address: customer.address.trim().slice(0, 250), city: String(customer.city || '').trim().slice(0, 80) },
    userId: linked, note: String(note || '').trim().slice(0, 300), status: pending ? 'Pending payment' : 'Confirmed', payment: pending ? 'Awaiting payment' : 'Due on delivery',
    source: 'checkout', reserved: true, installments: method === 'koko' ? installment(q.total) : null,
    expiresAt: pending ? new Date(Date.now() + s.settings.reservationMinutes * 60000).toISOString() : null,
    shipment: null, events: [ev(date, pending ? 'Pending payment' : 'Confirmed', pending ? null : 'Order confirmed · cash on delivery', 'Checkout')], notes: []
  };
  for (const l of q.lines) moveStock(s, l, -l.qty, 'order', order.id, 'Checkout');
  if (q.code) s.discounts.find(d => d.code === q.code).uses++;
  s.orders.unshift(order);
  notice(s, 'order', `New order ${order.id} · ${money(order.total)}${pending ? ' · awaiting payment' : ' · COD'}`, '/dashboard/orders?open=' + order.id);
  if (!pending) {
    s.transactions.unshift({ id: uid('TX'), date, method, outcome: 'Awaiting cash', total: q.total, token, orderId: order.id, source: 'checkout' });
    notify(s, { to: email, phone: order.customer.phone, subject: `Order ${order.id} confirmed`, body: `Thank you, ${order.customer.name.split(' ')[0]}! We’re preparing your order. Pay ${money(order.total)} in cash on delivery. Track it any time: ${trackLink(order)}`, orderId: order.id });
  }
  localStorage.setItem(BAG, '[]'); save(s);
  return clone(order);
}

/* ---------------------------------------------------------------- mock payment gateway + signed webhook (stands in for /api/payhere/notify) */
export const signature = (orderId, amount, statusCode = '') => {
  const str = MERCHANT.secret + '|' + orderId + '|' + Number(amount).toFixed(2) + '|LKR|' + statusCode;
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
  return ((a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0')).toUpperCase();
};
export function gatewayParams(order) { return { merchant_id: MERCHANT.id, order_id: order.id, amount: order.total.toFixed(2), currency: 'LKR', hash: signature(order.id, order.total) }; }
export const STATUS_CODES = { approved: 2, cancelled: -1, declined: -2 };
// What the gateway's server would POST to us. `forge` produces a payload with a bad signature.
export function gatewayPayload(order, outcome, forge = false) {
  const code = STATUS_CODES[outcome];
  return { merchant_id: MERCHANT.id, order_id: order.id, payment_id: 'PH' + Date.now().toString().slice(-9), payhere_amount: order.total.toFixed(2), payhere_currency: 'LKR', status_code: code, method: order.method === 'koko' ? 'KOKO' : 'VISA', md5sig: forge ? 'FORGED0000000000' : signature(order.id, order.total, code) };
}
export function webhook(payload) {
  const s = load(), o = s.orders.find(o => o.id === payload?.order_id), date = nowIso();
  const log = (outcome, verified) => s.transactions.unshift({ id: uid('TX'), date, method: o?.method || 'online', outcome, total: Number(payload?.payhere_amount) || 0, orderId: o?.id || payload?.order_id || null, source: 'webhook', verified, ref: payload?.payment_id });
  if (!o) { log('Rejected · unknown order', false); save(s); throw Error('Webhook rejected: unknown order.'); }
  if (payload.md5sig !== signature(o.id, Number(payload.payhere_amount), payload.status_code)) { log('Rejected · bad signature', false); save(s); throw Error('Webhook rejected: signature does not match.'); }
  if (Number(payload.payhere_amount) !== o.total || payload.payhere_currency !== 'LKR') { log('Rejected · amount mismatch', false); save(s); throw Error('Webhook rejected: amount does not match the order.'); }
  const code = Number(payload.status_code);
  if (code !== 2) { log(code === -1 ? 'Cancelled by customer' : 'Declined (mock)', true); save(s); return clone(o); }
  if (o.payment === 'Paid (mock)' || o.payment === 'Plan approved (mock)') { log('Duplicate notification ignored', true); save(s); return clone(o); }
  if (o.status !== 'Pending payment') {
    log('Paid after expiry · auto-refunded (mock)', true);
    o.events.unshift(ev(date, o.status, 'A late payment arrived after the order expired and was refunded', 'System'));
    save(s); return clone(o);
  }
  o.status = 'Confirmed'; o.payment = paymentFor(o.method, 'Confirmed'); o.expiresAt = null;
  o.events.unshift(ev(date, 'Confirmed', o.method === 'koko' ? 'Instalment plan approved · order confirmed' : 'Payment received · order confirmed', 'Payment gateway'));
  log('Approved (mock)', true);
  notice(s, 'payment', `Payment received for ${o.id} · ${money(o.total)}`, '/dashboard/orders?open=' + o.id);
  notify(s, { to: o.customer.email, phone: o.customer.phone, subject: `Order ${o.id} confirmed`, body: `Thank you, ${o.customer.name.split(' ')[0]}! We received ${money(o.total)}. Track your order: ${trackLink(o)}`, orderId: o.id });
  save(s); return clone(o);
}
export function payOrder(orderId, outcome, forge = false) { const o = load().orders.find(o => o.id === orderId); if (!o) throw Error('Order not found.'); return webhook(gatewayPayload(o, outcome, forge)); }

// Stands in for the Vercel cron job: cancel unpaid online orders whose reservation window has passed.
export function expireUnpaid(at = Date.now()) {
  const s = load(); let n = 0;
  for (const o of s.orders) if (o.status === 'Pending payment' && o.expiresAt && new Date(o.expiresAt).getTime() <= at) {
    for (const l of o.lines) moveStock(s, l, l.qty, 'cancel', o.id, 'Expiry job');
    o.reserved = false; o.status = 'Cancelled'; o.payment = 'Cancelled'; o.expiresAt = null;
    o.events.unshift(ev(nowIso(), 'Cancelled', 'Payment not completed in time · pieces returned to stock', 'Expiry job')); n++;
  }
  if (n) { audit(s, SYSTEM, 'Expired unpaid orders', n + ' order(s)'); save(s); }
  return n;
}

/* ---------------------------------------------------------------- order status machine (stands in for set_order_status()) */
const RULES = {
  'Pending payment': { Cancelled: 'manager' },
  Confirmed: { Packed: 'staff', Cancelled: 'manager' },
  Packed: { Shipped: 'staff', Confirmed: 'staff', Cancelled: 'manager' },
  Shipped: { 'Out for delivery': 'staff', Delivered: 'staff', Returned: 'manager' },
  'Out for delivery': { Delivered: 'staff', Shipped: 'staff', Returned: 'manager' },
  Delivered: { Returned: 'manager' }, Cancelled: {}, Returned: {}
};
export function nextStatuses(o, actor) {
  const r = { ...RULES[o.status] };
  if (o.delivery === 'collection') { delete r.Shipped; if (o.status === 'Packed') r.Delivered = 'staff'; }
  return Object.keys(r).filter(k => atLeast(actor, r[k]));
}
export function setStatus(id, to, opts = {}, actor = SYSTEM) {
  const s = load(), o = s.orders.find(o => o.id === id); if (!o) throw Error('Order not found.');
  if (!STATUSES.includes(to)) throw Error('Invalid order status.');
  if (o.status === to) return clone(o);
  if (!nextStatuses(o, actor).includes(to)) throw Error(RULES[o.status][to] && !atLeast(actor, RULES[o.status][to]) ? `Only a ${RULES[o.status][to]} can move an order to ${to}.` : `An order can’t go from ${o.status} to ${to}.`);
  const date = nowIso(), by = actorName(actor), before = o.payment, first = o.customer.name.split(' ')[0];
  let text = opts.note?.trim() || null;
  if (to === 'Shipped') {
    const courier = opts.courier, tracking = String(opts.tracking || '').trim();
    if (!s.settings.couriers.some(c => c.name === courier)) throw Error('Choose a courier.');
    if (!/^[A-Za-z0-9-]{4,30}$/.test(tracking) && courier !== 'Studio rider') throw Error('Enter the courier tracking number.');
    o.shipment = { courier, tracking, url: trackingUrl(s.settings.couriers, courier, tracking), date };
    text = `Shipped with ${courier}${tracking ? ' · ' + tracking : ''}`;
  }
  if (to === 'Cancelled' || to === 'Returned') {
    if (o.reserved || to === 'Returned') for (const l of o.lines) { const q = l.qty - (to === 'Returned' ? returnedQty(s, o, l.sku) : 0); if (q > 0) moveStock(s, l, q, to === 'Returned' ? 'return' : 'cancel', o.id, by); }
    o.reserved = false; o.expiresAt = null;
    o.payment = o.method === 'cod' ? (o.payment === 'Collected (mock)' ? 'Refunded (mock)' : 'Cancelled') : o.payment === 'Awaiting payment' ? 'Cancelled' : 'Refunded (mock)';
  }
  if (to === 'Delivered' && o.status !== 'Delivered') o.reserved = false;
  o.status = to;
  o.events.unshift(ev(date, to, text || (o.delivery === 'collection' && to === 'Delivered' ? 'Collected from the studio' : null), by));
  if (o.payment !== before) s.transactions.unshift({ id: uid('TX'), date, method: o.method, outcome: o.payment, total: o.total, orderId: o.id, source: 'studio' });
  const msgs = {
    Shipped: [`Your order ${o.id} is on its way`, `Good news, ${first}! ${o.shipment?.courier} is bringing your parcel. Tracking number ${o.shipment?.tracking}. Follow it here: ${trackLink(o)}`],
    'Out for delivery': [`${o.id} is out for delivery today`, `Your ROMANZ parcel will reach you today.${o.method === 'cod' ? ' Please keep ' + money(o.total) + ' ready for the courier.' : ''}`],
    Delivered: [`${o.id} has been delivered`, `We hope you love it, ${first}. Care tips: /care`],
    Cancelled: [`Order ${o.id} was cancelled`, o.payment === 'Refunded (mock)' ? `We’ve refunded ${money(o.total)} to your original payment method (mock).` : 'No payment was taken.'],
    Returned: [`Return received for ${o.id}`, `We’ve refunded ${money(o.total)} (mock).`]
  };
  if (msgs[to]) notify(s, { to: o.customer.email, phone: ['Shipped', 'Out for delivery'].includes(to) ? o.customer.phone : '', subject: msgs[to][0], body: msgs[to][1], orderId: o.id });
  audit(s, actor, 'Order ' + to.toLowerCase(), o.id + (text ? ' · ' + text : ''));
  save(s); return clone(o);
}
export function bulkStatus(ids, to, actor) { const errors = []; for (const id of ids) { try { setStatus(id, to, {}, actor); } catch (e) { errors.push(id + ': ' + e.message); } } return errors; }
export function collectCash(id, actor) {
  const s = load(), o = s.orders.find(o => o.id === id); if (!o) throw Error('Order not found.');
  if (o.method !== 'cod' || o.status !== 'Delivered' || o.payment !== 'Due on delivery') throw Error('Cash can only be marked collected for a delivered COD order.');
  o.payment = 'Collected (mock)'; o.events.unshift(ev(nowIso(), 'Delivered', 'Cash collected by courier', actorName(actor), false));
  s.transactions.unshift({ id: uid('TX'), date: nowIso(), method: 'cod', outcome: o.payment, total: o.total, orderId: o.id, source: 'studio' });
  audit(s, actor, 'COD collected', o.id); save(s); return clone(o);
}
// Backwards-compatible helper used by older code/tests.
export function updateOrder(id, status, collect = false) { if (status !== load().orders.find(o => o.id === id)?.status) setStatus(id, status, {}, SYSTEM); if (collect) collectCash(id, SYSTEM); return load().orders.find(o => o.id === id); }
export function addNote(id, text, actor) {
  if (!text?.trim()) throw Error('Write a note first.');
  const s = load(), o = s.orders.find(o => o.id === id); if (!o) throw Error('Order not found.');
  o.notes.unshift({ date: nowIso(), by: actorName(actor), text: text.trim().slice(0, 500) }); save(s);
}

/* ---------------------------------------------------------------- tracking lookups */
export function findOrder(id, email) {
  const o = load().orders.find(o => o.id.toUpperCase() === String(id).trim().toUpperCase());
  if (!o || o.customer.email !== String(email).trim().toLowerCase()) throw Error('We couldn’t find an order with that number and email.');
  return o;
}
export const orderByToken = (id, token) => load().orders.find(o => o.id === id && o.trackToken === token) || null;
export const publicEvents = o => o.events.filter(e => e.visible);

/* ---------------------------------------------------------------- catalogue admin (item upload) */
function checkProduct(s, input) {
  const name = String(input.name || '').trim();
  if (!name || name.length > 70) throw Error('Enter a product name under 70 characters.');
  if (!Number.isInteger(input.price) || input.price < 100 || input.price > 1000000) throw Error('Price must be a whole LKR amount between 100 and 1,000,000.');
  if (input.compareAt != null && (!Number.isInteger(input.compareAt) || input.compareAt <= input.price)) throw Error('“Compare at” must be higher than the price, or empty.');
  if (!s.categories.some(c => c.slug === input.category)) throw Error('Choose a category.');
  if (!PRODUCT_STATUSES.includes(input.status)) throw Error('Choose a status.');
  if (!Array.isArray(input.images) || !input.images.length) throw Error('Add at least one photo.');
  if (input.images.length > 8) throw Error('Up to 8 photos per piece.');
  if (!input.images.every(p => validImage(s, p))) throw Error('One of the photos is missing or not allowed.');
  if (!Array.isArray(input.variants) || !input.variants.length) throw Error('Add at least one size or option.');
  const seen = new Set();
  for (const v of input.variants) {
    const opt = String(v.option || '').trim();
    if (!opt || opt.length > 30) throw Error('Every option needs a label (e.g. “US 6” or “Pair”).');
    if (seen.has(opt.toLowerCase())) throw Error('Option “' + opt + '” is listed twice.'); seen.add(opt.toLowerCase());
    if (!/^[A-Z0-9-]{3,24}$/.test(v.sku || '')) throw Error('SKU for “' + opt + '” must be 3–24 capital letters, digits or dashes.');
    if (s.products.some(p => p.id !== input.id && p.variants.some(x => x.sku === v.sku))) throw Error('SKU ' + v.sku + ' is already used by another piece.');
    if (!Number.isInteger(v.stock) || v.stock < 0 || v.stock > 999) throw Error('Stock must be from 0 to 999.');
    if (v.price != null && (!Number.isInteger(v.price) || v.price < 100 || v.price > 1000000)) throw Error('Option price must be a whole LKR amount, or empty to use the main price.');
  }
  if (new Set(input.variants.map(v => v.sku)).size !== input.variants.length) throw Error('Each option needs its own SKU.');
  return name;
}
const slugify = t => t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'piece';
export const suggestSku = (name, option) => skuFor(slugify(name), option);

export function saveProduct(input, actor = SYSTEM) {
  if (!atLeast(actor, 'manager')) throw Error('Only managers can edit products.');
  const s = load(), name = checkProduct(s, input), by = actorName(actor);
  let p = s.products.find(p => p.id === input.id);
  const fields = { name, category: input.category, description: String(input.description || '').trim().slice(0, 800) || 'A new piece in the ROMANZ collection.', finish: String(input.finish || '').trim().slice(0, 60), tag: String(input.tag || '').trim().slice(0, 30) || 'New arrival', price: input.price, compareAt: input.compareAt ?? null, status: input.status, featured: !!input.featured, images: [...input.images] };
  const variants = input.variants.map(v => ({ sku: v.sku, option: String(v.option).trim(), price: v.price ?? null, stock: v.stock, low: Number.isInteger(v.low) ? v.low : 2, active: v.active !== false }));
  if (p) {
    for (const v of variants) {
      const old = p.variants.find(x => x.sku === v.sku), delta = v.stock - (old ? old.stock : 0);
      if (delta) s.movements.unshift({ id: uid('MV'), date: nowIso(), productId: p.id, sku: v.sku, option: v.option, delta, reason: old ? 'adjustment' : 'restock', orderId: null, by, note: old ? 'Edited in product editor' : 'New option' });
    }
    Object.assign(p, fields, { variants }); audit(s, actor, 'Product updated', name);
  } else {
    let id = slugify(name); while (s.products.some(p => p.id === id)) id = slugify(name) + '-' + Math.random().toString(36).slice(2, 5);
    p = { id, ...fields, variants, createdAt: nowIso() };
    for (const v of variants) if (v.stock) s.movements.unshift({ id: uid('MV'), date: nowIso(), productId: id, sku: v.sku, option: v.option, delta: v.stock, reason: 'restock', orderId: null, by, note: 'Opening stock' });
    s.products.unshift(p); audit(s, actor, 'Product created', name);
  }
  derive(p); save(s); gcMedia(s); return clone(p);
}
// Older simple editor/test signature: { id?, name, price, stock, active, category, image }.
export function product(input) {
  const s = load(), p = s.products.find(p => p.id === input.id);
  if (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > 999) throw Error('Stock must be from 0 to 999.');
  const variants = p ? p.variants.map((v, i) => ({ ...v, stock: i === 0 ? input.stock : 0 })) : (OPTION_PRESETS[input.category] || ['Standard']).map((o, i) => ({ sku: suggestSku(input.name || 'piece', o), option: o, price: null, stock: i === 0 ? input.stock : 0 }));
  return saveProduct({ ...(p || {}), ...input, images: p && input.image === p.image ? p.images : [input.image], status: input.active === false ? 'draft' : 'active', variants }, SYSTEM);
}
export function duplicateProduct(id, actor) {
  const p = load().products.find(p => p.id === id); if (!p) throw Error('Product not found.');
  const tail = Math.random().toString(36).slice(2, 5).toUpperCase();
  return saveProduct({ ...p, id: undefined, name: (p.name + ' copy').slice(0, 70), status: 'draft', variants: p.variants.map(v => ({ ...v, sku: (v.sku.slice(0, 19) + '-' + tail), stock: 0 })) }, actor);
}
export function setProductStatus(id, status, actor) { const p = load().products.find(p => p.id === id); if (!p) throw Error('Product not found.'); return saveProduct({ ...p, status }, actor); }
export function adjustStock(productId, sku, delta, reason, note, actor) {
  if (!atLeast(actor, 'manager')) throw Error('Only managers can adjust stock.');
  if (!Number.isInteger(delta) || !delta || Math.abs(delta) > 999) throw Error('Enter a whole number of pieces to add or remove.');
  if (!['restock', 'adjustment', 'damaged', 'return'].includes(reason)) throw Error('Choose a reason.');
  const s = load(), p = s.products.find(p => p.id === productId), v = p?.variants.find(v => v.sku === sku);
  if (!v) throw Error('Option not found.');
  if (v.stock + delta < 0) throw Error(`Only ${v.stock} in stock, so you can remove at most ${v.stock}.`);
  if (v.stock + delta > 999) throw Error('Stock can’t go above 999.');
  moveStock(s, { id: p.id, sku }, delta, reason, null, actorName(actor), String(note || '').slice(0, 200));
  audit(s, actor, 'Stock ' + (delta > 0 ? '+' : '') + delta, `${p.name} · ${v.option} (${reason})`); save(s);
}
export function saveCategory({ slug, name, active = true }, actor) {
  if (!atLeast(actor, 'manager')) throw Error('Only managers can edit categories.');
  const s = load(), n = String(name || '').trim(); if (!n || n.length > 30) throw Error('Category names need 1–30 characters.');
  const c = s.categories.find(c => c.slug === slug);
  if (c) Object.assign(c, { name: n, active }); else { const sl = slugify(n); if (s.categories.some(c => c.slug === sl)) throw Error('That category already exists.'); s.categories.push({ slug: sl, name: n, active: true }); }
  audit(s, actor, c ? 'Category updated' : 'Category added', n); save(s);
}

/* ---------------------------------------------------------------- CSV import */
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter(r => r.some(c => c.trim()));
  if (!clean.length) return [];
  const head = clean[0].map(h => h.trim().toLowerCase());
  return clean.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}
export const CSV_TEMPLATE = 'name,category,price,option,sku,stock,image,status,description,finish\n"Nova Stacking Ring",rings,6900,US 6,NOVASTACK-US6,4,ring.jpg,draft,"A slim stacking band.",Gold tone\n"Nova Stacking Ring",rings,6900,US 7,NOVASTACK-US7,3,ring.jpg,draft,,\n"Petal Studs",earrings,3500,Pair,PETAL-PAIR,10,products/hoops.jpg,active,"Tiny petal studs.",Gold tone\n';
// Groups rows by product name into products with options. Returns what would be created/updated and any row errors.
export function planImport(text) {
  const s = load(), rows = parseCSV(text), groups = new Map(), errors = [];
  if (!rows.length) return { items: [], errors: ['The file is empty or has no rows under the header.'] };
  rows.forEach((r, i) => {
    const line = i + 2, price = Number(r.price), stock = Number(r.stock || 0);
    if (!r.name) return errors.push(`Row ${line}: name is required.`);
    if (!s.categories.some(c => c.slug === r.category)) return errors.push(`Row ${line}: unknown category “${r.category}”.`);
    if (!Number.isInteger(price)) return errors.push(`Row ${line}: price must be a whole number.`);
    if (!Number.isInteger(stock)) return errors.push(`Row ${line}: stock must be a whole number.`);
    const key = r.name.toLowerCase(), existing = s.products.find(p => p.name.toLowerCase() === key);
    const first = !groups.has(key);
    const g = groups.get(key) || { input: existing ? clone(existing) : { name: r.name, category: r.category, price, status: 'draft', images: [], variants: [], description: '', finish: '' }, existing: !!existing };
    Object.assign(g.input, { category: r.category, price });
    if (r.status) g.input.status = r.status.toLowerCase();
    if (r.description) g.input.description = r.description;
    if (r.finish) g.input.finish = r.finish;
    if (r.image) g.input.images = existing && first ? [r.image] : [...new Set([...g.input.images, r.image])];
    const option = r.option || 'Standard', sku = (r.sku || suggestSku(r.name, option)).toUpperCase();
    const v = g.input.variants.find(v => v.sku === sku || v.option === option);
    if (v) Object.assign(v, { option, sku, stock }); else g.input.variants.push({ sku, option, price: null, stock, low: 2, active: true });
    groups.set(key, g);
  });
  const items = [];
  for (const g of groups.values()) {
    try { checkProduct(s, g.input); items.push({ ...g, ok: true }); }
    catch (e) { errors.push(`“${g.input.name}”: ${e.message}`); items.push({ ...g, ok: false, error: e.message }); }
  }
  return { items, errors };
}
export function importProducts(text, actor) {
  if (!atLeast(actor, 'manager')) throw Error('Only managers can import products.');
  const plan = planImport(text); let created = 0, updated = 0;
  for (const it of plan.items.filter(i => i.ok)) { saveProduct(it.input, actor); it.existing ? updated++ : created++; }
  const s = load(); audit(s, actor, 'CSV import', `${created} created, ${updated} updated, ${plan.errors.length} problem(s)`); save(s);
  return { created, updated, errors: plan.errors };
}

/* ---------------------------------------------------------------- discounts */
export function saveDiscount(input, actor) {
  if (!atLeast(actor, 'manager')) throw Error('Only managers can edit discount codes.');
  const s = load(), code = String(input.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) throw Error('Codes are 3–20 letters or digits.');
  if (!['percent', 'fixed'].includes(input.type)) throw Error('Choose a discount type.');
  if (!Number.isInteger(input.value) || input.value < 1 || (input.type === 'percent' && input.value > 90)) throw Error(input.type === 'percent' ? 'Percent must be 1–90.' : 'Amount must be a whole LKR value.');
  if (!Number.isInteger(input.min) || input.min < 0) throw Error('Minimum spend must be 0 or more.');
  if (!Number.isInteger(input.maxUses) || input.maxUses < 0) throw Error('Max uses must be 0 (unlimited) or more.');
  const d = s.discounts.find(d => d.code === code), data = { code, type: input.type, value: input.value, min: input.min, maxUses: input.maxUses, active: !!input.active, endsAt: input.endsAt || null };
  if (d) Object.assign(d, data); else s.discounts.unshift({ ...data, uses: 0 });
  audit(s, actor, d ? 'Discount updated' : 'Discount created', code); save(s);
}

/* ---------------------------------------------------------------- inbox */
export function sendMessage({ name, email, topic, body, orderId }) {
  if (!name?.trim() || !email?.includes('@') || !body?.trim()) throw Error('Please add your name, email and a message.');
  const s = load();
  s.messages.unshift({ id: uid('MSG'), date: nowIso(), name: name.trim().slice(0, 80), email: email.trim().slice(0, 120), topic: topic || 'General', body: body.trim().slice(0, 2000), read: false, replies: [], orderId: orderId?.trim() || null });
  notice(s, 'message', `Message from ${name.trim()} · ${topic || 'General'}`, '/dashboard/inbox');
  save(s);
}
export function markRead(id, read = true) { const s = load(), m = s.messages.find(m => m.id === id); if (m && m.read !== read) { m.read = read; save(s); } }
export function replyMessage(id, body, actor) {
  if (!body?.trim()) throw Error('Write a reply first.');
  const s = load(), m = s.messages.find(m => m.id === id); if (!m) throw Error('Message not found.');
  m.replies.push({ date: nowIso(), by: actorName(actor), body: body.trim().slice(0, 2000) }); m.read = true;
  notify(s, { to: m.email, subject: 'Re: ' + m.topic, body: body.trim() }); audit(s, actor, 'Replied to message', m.email); save(s);
}

/* ---------------------------------------------------------------- accounts & team (stands in for Supabase Auth + profiles) */
export function authenticate(email, password) {
  const u = load().users.find(u => u.email === String(email).trim().toLowerCase() && u.password === password);
  if (!u) throw Error('Email or password is incorrect. Try one of the demo accounts.');
  if (!u.active) throw Error('This account has been deactivated. Ask an administrator.');
  return u;
}
export function register({ name, email, password, phone }) {
  const s = load(), e = String(email || '').trim().toLowerCase();
  if (!name?.trim()) throw Error('Please add your name.');
  if (!/^\S+@\S+\.\S+$/.test(e)) throw Error('Please enter a valid email.');
  if (String(password || '').length < 8) throw Error('Use at least 8 characters for your password.');
  if (s.users.some(u => u.email === e)) throw Error('An account with that email already exists. Sign in instead.');
  const u = { id: uid('u').toLowerCase(), name: name.trim().slice(0, 80), email: e, password, role: 'customer', title: 'ROMANZ Circle member', phone: String(phone || '').slice(0, 16), addresses: [], wishlist: [], active: true, createdAt: nowIso() };
  s.users.push(u);
  for (const o of s.orders) if (o.customer.email === e && !o.userId) o.userId = u.id; // link earlier guest orders
  notify(s, { to: e, subject: 'Welcome to ROMANZ', body: `Hi ${u.name.split(' ')[0]}, your account is ready. Your orders and tracking now live under My account.` });
  save(s); return u;
}
export function requestReset(email) {
  const s = load(), u = s.users.find(u => u.email === String(email).trim().toLowerCase());
  if (u) { u.resetCode = String(100000 + Math.floor(Math.random() * 900000)); notify(s, { to: u.email, subject: 'Reset your ROMANZ password', body: `Your reset code is ${u.resetCode}. Enter it on the sign-in page to choose a new password.` }); save(s); }
  return true; // same answer either way, so emails can't be probed
}
export function resetPassword(email, code, password) {
  const s = load(), u = s.users.find(u => u.email === String(email).trim().toLowerCase());
  if (!u || !u.resetCode || u.resetCode !== String(code).trim()) throw Error('That code is not right. Check the latest email in the demo outbox.');
  if (String(password || '').length < 8) throw Error('Use at least 8 characters for your password.');
  u.password = password; delete u.resetCode; save(s);
}
export function updateProfile(id, { name, phone }) {
  const s = load(), u = s.users.find(u => u.id === id); if (!u) throw Error('Account not found.');
  if (!name?.trim()) throw Error('Name can’t be empty.');
  if (phone && !/^[0-9 +()-]{9,16}$/.test(phone)) throw Error('Please check your phone number.');
  Object.assign(u, { name: name.trim().slice(0, 80), phone: String(phone || '').trim() }); save(s);
}
export function saveAddress(userId, addr) {
  const s = load(), u = s.users.find(u => u.id === userId); if (!u) throw Error('Account not found.');
  if (!addr.address?.trim() || !addr.city?.trim()) throw Error('Add the street address and city.');
  const a = { id: addr.id || uid('a').toLowerCase(), label: String(addr.label || 'Address').slice(0, 20), address: addr.address.trim().slice(0, 250), city: addr.city.trim().slice(0, 80), phone: String(addr.phone || '').slice(0, 16), isDefault: !!addr.isDefault || !u.addresses.length };
  if (a.isDefault) u.addresses.forEach(x => x.isDefault = false);
  const i = u.addresses.findIndex(x => x.id === a.id); i >= 0 ? (u.addresses[i] = a) : u.addresses.push(a);
  save(s);
}
export function removeAddress(userId, id) { const s = load(), u = s.users.find(u => u.id === userId); if (!u) return; u.addresses = u.addresses.filter(a => a.id !== id); if (u.addresses.length && !u.addresses.some(a => a.isDefault)) u.addresses[0].isDefault = true; save(s); }

export function inviteMember({ name, email, role, title }, actor) {
  if (!atLeast(actor, 'admin')) throw Error('Only administrators can invite team members.');
  const s = load(), e = String(email || '').trim().toLowerCase();
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(e)) throw Error('Add a name and a valid email.');
  if (!['staff', 'manager', 'admin'].includes(role)) throw Error('Choose a role.');
  if (s.users.some(u => u.email === e)) throw Error('Someone with that email already has an account.');
  const password = 'rz-' + globalThis.crypto.randomUUID().slice(0, 6);
  s.users.push({ id: uid('u').toLowerCase(), name: name.trim().slice(0, 80), email: e, password, role, title: String(title || '').slice(0, 60) || 'Team member', phone: '', addresses: [], active: true, createdAt: nowIso() });
  notify(s, { to: e, subject: 'You’re invited to ROMANZ Studio', body: `${actorName(actor)} added you as ${role}. Sign in at /login with ${e} and temporary password ${password}.` });
  audit(s, actor, 'Invited team member', `${e} as ${role}`); save(s); return password;
}
export function setMember(id, changes, actor) {
  if (!atLeast(actor, 'admin')) throw Error('Only administrators can change the team.');
  const s = load(), u = s.users.find(u => u.id === id); if (!u) throw Error('Member not found.');
  if (u.id === actor.id && (changes.role && changes.role !== u.role || changes.active === false)) throw Error('You can’t change your own role or deactivate yourself.');
  const admins = s.users.filter(x => x.role === 'admin' && x.active && x.id !== id).length;
  if (u.role === 'admin' && !admins && (changes.role && changes.role !== 'admin' || changes.active === false)) throw Error('Keep at least one active administrator.');
  if (changes.role && !['staff', 'manager', 'admin', 'customer'].includes(changes.role)) throw Error('Invalid role.');
  Object.assign(u, changes.role ? { role: changes.role } : {}, 'active' in changes ? { active: !!changes.active } : {});
  audit(s, actor, 'Team member updated', `${u.email}${changes.role ? ' → ' + changes.role : ''}${'active' in changes ? (changes.active ? ' · reactivated' : ' · deactivated') : ''}`); save(s);
}

export function saveSettings(settings, actor = SYSTEM) {
  const s = load(), n = { ...s.settings, ...settings };
  if (!Number.isInteger(n.shippingFee) || n.shippingFee < 0 || n.shippingFee > 10000) throw Error('Delivery fee must be 0–10,000 LKR.');
  if (!Number.isInteger(n.freeShippingOver) || n.freeShippingOver < 0) throw Error('Free delivery threshold must be 0 (off) or more.');
  if (!Number.isInteger(n.reservationMinutes) || n.reservationMinutes < 1 || n.reservationMinutes > 1440) throw Error('Payment window must be 1–1440 minutes.');
  if (!Number.isInteger(n.returnDays) || n.returnDays < 0 || n.returnDays > 90) throw Error('Return window must be 0–90 days.');
  if (!Array.isArray(n.couriers) || !n.couriers.length || n.couriers.some(c => !c.name?.trim())) throw Error('Keep at least one courier, each with a name.');
  s.settings = n; audit(s, actor, 'Settings saved', Object.keys(settings).join(', ')); save(s);
}

/* ---------------------------------------------------------------- reporting */
export function customers(state = load()) {
  const map = new Map();
  for (const u of state.users.filter(u => u.role === 'customer')) map.set(u.email, { name: u.name, email: u.email, city: u.addresses?.[0]?.city || '', phone: u.phone, orders: 0, spent: 0, last: null, account: true });
  for (const o of state.orders) {
    const c = map.get(o.customer.email) || { ...o.customer, orders: 0, spent: 0, last: o.date, account: false };
    c.orders++; if (!['Cancelled', 'Returned', 'Pending payment'].includes(o.status)) c.spent += o.total - (o.refunded || 0);
    if (!c.last || o.date > c.last) c.last = o.date; if (!c.city) c.city = o.customer.city; if (!c.phone) c.phone = o.customer.phone;
    map.set(o.customer.email, c);
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent);
}
export const lowStock = (state = load()) => state.products.filter(p => p.status !== 'archived').flatMap(p => p.variants.filter(v => v.active && v.stock <= v.low).map(v => ({ p, v }))).sort((a, b) => a.v.stock - b.v.stock);
export const isRevenue = o => !['Cancelled', 'Returned', 'Pending payment'].includes(o.status);

/* ================================================================ advanced mock features (v5) */

/* ---------------------------------------------------------------- studio notification feed */
function notice(s, type, text, link) {
  s.notices.unshift({ id: uid('NT'), date: nowIso(), type, text, link, readBy: [] });
  s.notices.length = Math.min(s.notices.length, 200);
}
export function markNotices(userId, ids) {
  const s = load(); let changed = false;
  for (const n of s.notices) if ((!ids || ids.includes(n.id)) && !n.readBy.includes(userId)) { n.readBy.push(userId); changed = true; }
  if (changed) save(s);
}

/* ---------------------------------------------------------------- reviews & ratings */
export function ratingOf(state, productId) {
  const list = state.reviews.filter(r => r.productId === productId && r.status === 'published');
  return { count: list.length, avg: list.length ? Math.round(list.reduce((a, r) => a + r.rating, 0) / list.length * 10) / 10 : 0 };
}
const boughtAndReceived = (s, email, productId) => s.orders.some(o => o.customer.email === email && ['Delivered', 'Returned'].includes(o.status) && o.lines.some(l => l.id === productId));
export function submitReview({ productId, rating, title, body, name, email }) {
  const s = load(), e = String(email || '').trim().toLowerCase();
  if (!s.products.some(p => p.id === productId && p.status === 'active')) throw Error('This piece is not available for reviews.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw Error('Choose a star rating.');
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(e)) throw Error('Add your name and email (your email is never shown).');
  if (!body?.trim() || body.trim().length < 10) throw Error('Write at least a sentence (10+ characters).');
  if (s.reviews.some(r => r.productId === productId && r.email === e && r.status !== 'hidden')) throw Error('You’ve already reviewed this piece. Thank you!');
  const verified = boughtAndReceived(s, e, productId);
  const r = { id: uid('RV'), productId, email: e, name: name.trim().slice(0, 40), rating, title: String(title || '').trim().slice(0, 80), body: body.trim().slice(0, 1200), date: nowIso(), status: 'pending', verified, reply: null };
  s.reviews.unshift(r);
  notice(s, 'review', `New ${rating}★ review${verified ? ' (verified buyer)' : ''} waiting for approval`, '/dashboard/reviews');
  save(s); return r;
}
export function moderateReview(id, status, actor) {
  if (!atLeast(actor, 'manager')) throw Error('Only managers can moderate reviews.');
  if (!['published', 'hidden', 'pending'].includes(status)) throw Error('Invalid review status.');
  const s = load(), r = s.reviews.find(r => r.id === id); if (!r) throw Error('Review not found.');
  r.status = status; audit(s, actor, 'Review ' + status, `${r.rating}★ by ${r.name}`); save(s);
}
export function replyReview(id, body, actor) {
  if (!atLeast(actor, 'manager')) throw Error('Only managers can reply to reviews.');
  const s = load(), r = s.reviews.find(r => r.id === id); if (!r) throw Error('Review not found.');
  r.reply = body?.trim() ? { by: actorName(actor), body: body.trim().slice(0, 600), date: nowIso() } : null;
  if (r.reply) notify(s, { to: r.email, subject: 'ROMANZ replied to your review', body: r.reply.body });
  save(s);
}

/* ---------------------------------------------------------------- wishlist & recently viewed */
const readList = k => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
export function wishlist(userId, state) {
  if (!userId) return readList(WISH);
  return (state || load()).users.find(u => u.id === userId)?.wishlist || [];
}
export function toggleWish(productId, userId) {
  if (!userId) { const w = readList(WISH); localStorage.setItem(WISH, JSON.stringify(w.includes(productId) ? w.filter(x => x !== productId) : [productId, ...w].slice(0, 60))); emit(); return; }
  const s = load(), u = s.users.find(u => u.id === userId); if (!u) return;
  u.wishlist = u.wishlist?.includes(productId) ? u.wishlist.filter(x => x !== productId) : [productId, ...(u.wishlist || [])].slice(0, 60);
  save(s);
}
// Guest wishlist moves into the account on sign-in.
export function mergeGuestWishlist(userId) {
  const guest = readList(WISH); if (!guest.length) return;
  const s = load(), u = s.users.find(u => u.id === userId); if (!u) return;
  u.wishlist = [...new Set([...(u.wishlist || []), ...guest])].slice(0, 60);
  localStorage.removeItem(WISH); save(s);
}
export const recentlyViewed = () => readList(SEEN);
export function markViewed(productId) { const v = readList(SEEN).filter(x => x !== productId); localStorage.setItem(SEEN, JSON.stringify([productId, ...v].slice(0, 12))); }

/* ---------------------------------------------------------------- back-in-stock alerts */
export function subscribeAlert(productId, option, email) {
  const s = load(), e = String(email || '').trim().toLowerCase(), p = s.products.find(p => p.id === productId), v = variantOf(p, option);
  if (!v) throw Error('That size is not available.');
  if (!/^\S+@\S+\.\S+$/.test(e)) throw Error('Enter a valid email.');
  if (v.stock > 0) throw Error('Good news: this size is in stock now.');
  if (s.alerts.some(a => a.sku === v.sku && a.email === e && !a.notified)) return false;
  s.alerts.unshift({ id: uid('AL'), productId, sku: v.sku, option: v.option, email: e, date: nowIso(), notified: null });
  const waiting = s.alerts.filter(a => a.sku === v.sku && !a.notified).length;
  notice(s, 'alert', `${waiting} waiting for ${p.name} · ${v.option}`, '/dashboard/products?tab=waitlist');
  save(s); return true;
}
// Runs on every save: anyone waiting for a size that now has stock gets one email.
function fireAlerts(s) {
  for (const a of s.alerts || []) {
    if (a.notified) continue;
    const p = s.products.find(p => p.id === a.productId), v = p?.variants.find(v => v.sku === a.sku);
    if (p?.status === 'active' && v?.active && v.stock > 0) {
      a.notified = nowIso();
      notify(s, { to: a.email, subject: `${p.name} (${v.option}) is back in stock`, body: `The piece you asked about is available again, but only ${v.stock} left. Shop it here: /shop/${p.id}` });
    }
  }
}

/* ---------------------------------------------------------------- return & exchange requests (RMA) */
export const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'received'];
const deliveredAt = o => o.events.filter(e => e.status === 'Delivered').map(e => e.date).sort()[0] || null;
const returnedQty = (s, o, sku) => s.returns.filter(r => r.orderId === o.id && r.status === 'received').reduce((a, r) => a + r.items.filter(i => i.sku === sku).reduce((x, i) => x + i.qty, 0), 0);
export function returnWindow(o, state) {
  const s = state || load(), at = deliveredAt(o);
  if (o.status !== 'Delivered' || !at) return { ok: false, why: 'Returns open once the order is delivered.' };
  const days = s.settings.returnDays, end = new Date(at).getTime() + days * 86400000;
  if (Date.now() > end) return { ok: false, why: `The ${days}-day return window closed on ${new Date(end).toLocaleDateString('en-GB')}.` };
  if (s.returns.some(r => r.orderId === o.id && ['requested', 'approved'].includes(r.status))) return { ok: false, why: 'A return for this order is already in progress.' };
  return { ok: true, until: new Date(end).toISOString() };
}
export function requestReturn({ orderId, email, items, reason, type = 'refund', note = '' }) {
  const s = load(), o = s.orders.find(o => o.id === orderId);
  if (!o || o.customer.email !== String(email || '').trim().toLowerCase()) throw Error('Order not found for this account.');
  const w = returnWindow(o, s); if (!w.ok) throw Error(w.why);
  if (!['refund', 'exchange'].includes(type)) throw Error('Choose refund or exchange.');
  if (!reason) throw Error('Tell us why you’re returning it.');
  const picked = (items || []).filter(i => i.qty > 0);
  if (!picked.length) throw Error('Choose at least one piece to return.');
  for (const i of picked) {
    const l = o.lines.find(l => l.sku === i.sku); if (!l) throw Error('That piece is not in this order.');
    if (!Number.isInteger(i.qty) || i.qty > l.qty - returnedQty(s, o, i.sku)) throw Error(`You can return at most ${l.qty - returnedQty(s, o, i.sku)} × ${l.name}.`);
    if (type === 'exchange') {
      const p = s.products.find(p => p.id === l.id), v = variantOf(p, i.toOption);
      if (!v || i.toOption === l.option) throw Error(`Choose a different size for ${l.name}.`);
    }
  }
  const r = { id: 'RMA-' + (1000 + s.returns.length + 1), orderId: o.id, email: o.customer.email, name: o.customer.name, date: nowIso(), type, reason, note: String(note).trim().slice(0, 400), items: picked.map(i => ({ sku: i.sku, qty: i.qty, toOption: type === 'exchange' ? i.toOption : null })), status: 'requested', refund: 0, exchangeOrderId: null, label: null, log: [{ date: nowIso(), text: 'Requested by customer' }] };
  s.returns.unshift(r);
  o.events.unshift(ev(nowIso(), o.status, `${type === 'exchange' ? 'Exchange' : 'Return'} requested (${r.id})`, o.customer.name));
  notify(s, { to: o.customer.email, subject: `We received your ${type} request ${r.id}`, body: 'We’ll review it within one working day and email you the next steps.', orderId: o.id });
  notice(s, 'return', `${type === 'exchange' ? 'Exchange' : 'Return'} request ${r.id} for ${o.id}`, '/dashboard/returns');
  save(s); return clone(r);
}
export function decideReturn(id, decision, note, actor) {
  if (!atLeast(actor, 'manager')) throw Error('Only managers can approve or reject returns.');
  const s = load(), r = s.returns.find(r => r.id === id); if (!r) throw Error('Return not found.');
  if (r.status !== 'requested') throw Error('This return has already been decided.');
  if (!['approved', 'rejected'].includes(decision)) throw Error('Approve or reject.');
  if (decision === 'rejected' && !note?.trim()) throw Error('Give the customer a reason for rejecting.');
  const o = s.orders.find(o => o.id === r.orderId);
  r.status = decision; r.label = decision === 'approved' ? 'RL' + globalThis.crypto.randomUUID().slice(0, 8).toUpperCase() : null;
  r.log.unshift({ date: nowIso(), text: (decision === 'approved' ? 'Approved' : 'Rejected') + ' by ' + actorName(actor) + (note?.trim() ? ': ' + note.trim() : '') });
  o.events.unshift(ev(nowIso(), o.status, decision === 'approved' ? `Return ${r.id} approved · return label ${r.label}` : `Return ${r.id} not accepted${note?.trim() ? ': ' + note.trim() : ''}`, actorName(actor)));
  notify(s, { to: r.email, subject: `Your ${r.type} request ${r.id} was ${decision}`, body: decision === 'approved' ? `Pack the piece(s) in the original box and hand them to any Domex counter with return label ${r.label}. We’ll ${r.type === 'exchange' ? 'send your new size' : 'refund you'} as soon as they arrive.` : `Sorry, we can’t accept this return. ${note.trim()}`, orderId: o.id });
  audit(s, actor, 'Return ' + decision, r.id + ' · ' + o.id); save(s); return clone(r);
}
export function receiveReturn(id, actor) {
  if (!atLeast(actor, 'staff')) throw Error('Sign in to the studio first.');
  const s = load(), r = s.returns.find(r => r.id === id); if (!r) throw Error('Return not found.');
  if (r.status !== 'approved') throw Error('Only approved returns can be received.');
  const o = s.orders.find(o => o.id === r.orderId), by = actorName(actor), date = nowIso();
  if (r.type === 'exchange') for (const i of r.items) {
    const l = o.lines.find(l => l.sku === i.sku), v = variantOf(s.products.find(p => p.id === l.id), i.toOption);
    if (!v || v.stock < i.qty) throw Error(`${l.name} in ${i.toOption} is out of stock. Restock it or refund instead.`);
  }
  for (const i of r.items) { const l = o.lines.find(l => l.sku === i.sku); moveStock(s, { id: l.id, sku: l.sku }, i.qty, 'return', o.id, by, r.id); }
  r.status = 'received'; r.log.unshift({ date, text: 'Parcel received and checked by ' + by });
  if (r.type === 'refund') {
    r.refund = r.items.reduce((a, i) => a + o.lines.find(l => l.sku === i.sku).price * i.qty, 0);
    // a code discount is shared across lines pro rata, so the refund never exceeds what was paid
    if (o.discount) r.refund = Math.round(r.refund * (1 - o.discount / o.subtotal));
    o.refunded = (o.refunded || 0) + r.refund;
    const all = o.lines.every(l => returnedQty(s, o, l.sku) >= l.qty);
    const exchanged = s.returns.some(x => x.orderId === o.id && x.type === 'exchange' && x.status === 'received');
    if (all) o.status = 'Returned';
    o.payment = all && !exchanged ? 'Refunded (mock)' : 'Partially refunded (mock)';
    o.events.unshift(ev(date, all ? 'Returned' : o.status, `Return ${r.id} received · ${money(r.refund)} refunded`, by));
    s.transactions.unshift({ id: uid('TX'), date, method: o.method, outcome: all ? 'Refunded (mock)' : 'Partial refund (mock)', total: r.refund, orderId: o.id, source: 'studio' });
    notify(s, { to: r.email, subject: `Refund of ${money(r.refund)} for ${o.id}`, body: 'Your return arrived safely and we’ve refunded you (mock). It can take 5–7 working days to appear.', orderId: o.id });
  } else {
    const lines = r.items.map(i => { const l = o.lines.find(l => l.sku === i.sku), p = s.products.find(p => p.id === l.id), v = variantOf(p, i.toOption); return { id: p.id, sku: v.sku, name: p.name, image: p.image, option: v.option, price: 0, qty: i.qty }; });
    const x = { ...clone(o), id: 'RZ-' + s.seq++, token: 'exchange-' + r.id, trackToken: 'trk' + globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10), date, lines, subtotal: 0, discount: 0, code: null, shipping: 0, total: 0, status: 'Confirmed', payment: 'Exchange (no charge)', source: 'exchange', reserved: true, installments: null, expiresAt: null, shipment: null, notes: [], refunded: 0, events: [ev(date, 'Confirmed', `Replacement for ${o.id} (exchange ${r.id})`, by)] };
    for (const l of lines) moveStock(s, l, -l.qty, 'order', x.id, by, 'Exchange ' + r.id);
    s.orders.unshift(x); r.exchangeOrderId = x.id;
    o.events.unshift(ev(date, o.status, `Exchange ${r.id} received · new size sent as ${x.id}`, by));
    notify(s, { to: r.email, subject: `Your new size is on the way: ${x.id}`, body: `We received your return and created replacement order ${x.id}. Follow it here: ${trackLink(x)}`, orderId: x.id });
  }
  audit(s, actor, 'Return received', r.id); save(s); return clone(r);
}

/* ---------------------------------------------------------------- courier tracking simulator (stands in for a courier status webhook) */
export const HUBS = ['Colombo sorting centre', 'Kandy hub', 'Galle hub', 'Kurunegala hub', 'Jaffna hub'];
export function courierScan(orderId, kind) {
  const o = load().orders.find(o => o.id === orderId); if (!o?.shipment) throw Error('This order has not been shipped yet.');
  const courier = { id: 'courier', name: o.shipment.courier, role: 'system' };
  if (kind === 'out') return setStatus(o.id, 'Out for delivery', {}, courier);
  if (kind === 'delivered') return setStatus(o.id, 'Delivered', {}, courier);
  const s = load(), x = s.orders.find(x => x.id === orderId);
  if (!['Shipped', 'Out for delivery'].includes(x.status)) throw Error('The parcel is no longer with the courier.');
  if (kind === 'hub') {
    const hub = HUBS[Math.abs([...x.customer.city].reduce((a, c) => a + c.charCodeAt(0), 0)) % HUBS.length];
    x.events.unshift(ev(nowIso(), x.status, `Arrived at ${hub}`, courier.name));
  } else if (kind === 'failed') {
    x.events.unshift(ev(nowIso(), x.status, 'Delivery attempt failed: nobody available. The courier will try again tomorrow.', courier.name));
    if (x.status === 'Out for delivery') x.status = 'Shipped';
    notify(s, { to: x.customer.email, phone: x.customer.phone, subject: `We missed you: ${x.id}`, body: `${courier.name} couldn’t deliver today. They’ll try again tomorrow, or call ${s.settings.supportPhone} to arrange a time.`, orderId: x.id });
    notice(s, 'courier', `Failed delivery attempt for ${x.id}`, '/dashboard/orders?open=' + x.id);
  } else throw Error('Unknown courier event.');
  save(s); return clone(x);
}
// When "auto courier" is on, live orders move one step along every ~15 s so tracking can be watched end to end.
export function courierTick(now = Date.now()) {
  const s = load(); if (!s.settings.autoCourier) return 0;
  let n = 0;
  for (const o of s.orders.filter(o => o.source !== 'seed' && o.shipment && ['Shipped', 'Out for delivery'].includes(o.status))) {
    if (now - new Date(o.events[0].date).getTime() < 15000) continue;
    const atHub = o.events.some(e => e.text.startsWith('Arrived at'));
    try { courierScan(o.id, o.status === 'Out for delivery' ? 'delivered' : atHub ? 'out' : 'hub'); n++; } catch { /* moved on meanwhile */ }
  }
  return n;
}
