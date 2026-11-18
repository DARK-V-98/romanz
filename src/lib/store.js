/* Local-only commerce simulator, ported from the original dist/store.js. Never a payment or authentication service. */
import { PRODUCTS } from './catalog.js';

const KEY = 'romanz-demo-store-v3', BAG = 'romanz-bag-v1', EVT = 'romanz:change';
const clone = x => JSON.parse(JSON.stringify(x));
export const CATEGORIES = ['rings', 'necklaces', 'earrings', 'bracelets', 'sets'];
export const STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
export const SHIPPING = 350;

const base = clone(PRODUCTS);
const extra = [['luna-petite', 'Luna Petite Hoops', 'luna-hoops', 3900], ['luna-bold', 'Luna Bold Hoops', 'luna-hoops', 6900], ['aurora-rose', 'Aurora Rose Edition', 'aurora-ring', 13900], ['celeste-promise', 'Celeste Promise Ring', 'emerald-cut', 9900], ['link-mini', 'Petite Link Bracelet', 'link-bracelet', 4900], ['link-bold', 'Statement Link Bracelet', 'link-bracelet', 8900], ['golden-charms', 'Golden Charms Necklace', 'golden-hour', 8900], ['heritage-evening', 'Heritage Evening Set', 'heritage-set', 21900], ['royal-celebration', 'Royal Celebration Set', 'occasion-set', 34900]];
for (const [id, name, source, price] of extra) {
  const p = clone(base.find(p => p.id === source));
  Object.assign(p, { id, name, price, tag: 'New sample style', description: p.description + ' Illustrative sample variant; photography is shared with its collection.' });
  base.push(p);
}
export const IMAGES = [...new Set(base.map(p => p.image))];
const defaults = base.map((p, i) => ({ ...p, stock: 12 + i % 9, active: true }));
defaults[3].stock = 2; defaults[11].stock = 0; // a couple of low/out-of-stock rows so the dashboard has something to flag

// Deterministic sample data so every visitor sees the same demo.
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const PEOPLE = [['Demo Customer', 'customer@romanz.lk', 'Colombo 07'], ['Amaya Silva', 'amaya@example.com', 'Kandy'], ['Nimal Perera', 'nimal@example.com', 'Galle'], ['Sara Fernando', 'sara@example.com', 'Negombo'], ['Dilini Jayasuriya', 'dilini@example.com', 'Colombo 03'], ['Kavindu Rajapaksha', 'kavindu@example.com', 'Kurunegala'], ['Ishara Wickramasinghe', 'ishara@example.com', 'Matara'], ['Tharushi Gunawardena', 'tharushi@example.com', 'Colombo 05'], ['Ravindu Bandara', 'ravindu@example.com', 'Jaffna'], ['Nethmi Senanayake', 'nethmi@example.com', 'Nugegoda'], ['Shehan de Mel', 'shehan@example.com', 'Moratuwa'], ['Ayesha Rahman', 'ayesha@example.com', 'Dehiwala']];
const paymentFor = (method, status) => status === 'Cancelled' ? (method === 'cod' ? 'Cancelled' : 'Refunded (mock)') : method === 'cod' ? (status === 'Delivered' ? 'Collected (mock)' : 'Due on delivery') : method === 'koko' ? 'Plan approved (mock)' : 'Paid (mock)';

function sampleState() {
  const r = rng(20261118), now = Date.now(), orders = [], transactions = [];
  for (let i = 0; i < 64; i++) {
    const age = Math.floor(r() * 90), person = PEOPLE[i % 7 === 0 ? 0 : Math.floor(r() * PEOPLE.length)];
    const picks = [defaults[Math.floor(r() * defaults.length)]];
    if (r() > 0.7) picks.push(defaults[Math.floor(r() * defaults.length)]);
    const lines = picks.map(p => ({ id: p.id, name: p.name, image: p.image, option: p.options[0], price: p.price, qty: r() > 0.85 ? 2 : 1 }));
    const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0), delivery = r() > 0.8 ? 'collection' : 'standard', shipping = delivery === 'standard' ? SHIPPING : 0, total = subtotal + shipping;
    const method = ['online', 'online', 'cod', 'koko'][Math.floor(r() * 4)];
    const status = r() < 0.07 ? 'Cancelled' : age > 9 ? 'Delivered' : age > 3 ? 'Shipped' : 'Processing';
    const date = new Date(now - age * 86400000 - Math.floor(r() * 86400000)).toISOString();
    const o = { id: 'RZ-' + (10480 + i), token: 'seed-' + i, date, lines, subtotal, shipping, total, delivery, method, customer: { name: person[0], email: person[1], address: (12 + i) + ' Sample Lane', city: person[2] }, status, payment: paymentFor(method, status), source: 'seed', reserved: false, installments: method === 'koko' ? installment(total) : null };
    orders.push(o);
    transactions.push({ id: 'TX-S' + (5000 + i), date, method, outcome: method === 'cod' ? 'Awaiting cash' : 'Approved (mock)', total, orderId: o.id });
    if (o.payment !== paymentFor(method, 'Processing')) transactions.push({ id: 'TX-S' + (6000 + i), date, method, outcome: o.payment, total, orderId: o.id });
  }
  orders.sort((a, b) => b.date.localeCompare(a.date)); transactions.sort((a, b) => b.date.localeCompare(a.date));
  const messages = [
    { id: 'MSG-1', date: new Date(now - 3600e3 * 5).toISOString(), name: 'Amaya Silva', email: 'amaya@example.com', topic: 'Sizing', body: 'Hi! Is the Aurora Halo Ring available in a US 4.5? Asking for a surprise proposal 💍', read: false },
    { id: 'MSG-2', date: new Date(now - 3600e3 * 30).toISOString(), name: 'Kavindu Rajapaksha', email: 'kavindu@example.com', topic: 'Gifting', body: 'Can you add a handwritten note to an order going to Kandy? It is for my mother’s birthday.', read: false },
    { id: 'MSG-3', date: new Date(now - 3600e3 * 72).toISOString(), name: 'Nethmi Senanayake', email: 'nethmi@example.com', topic: 'Care', body: 'What is the best way to store gold-tone pieces during the monsoon? Mine went a little dull.', read: true }
  ];
  return { version: 3, products: clone(defaults), orders, transactions, messages, settings: { announcement: 'Complimentary gift wrapping on every order · Island-wide delivery', supportEmail: 'hello@romanz.lk' } };
}

const isState = v => v && v.version === 3 && ['products', 'orders', 'transactions', 'messages'].every(k => Array.isArray(v[k]));
export function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); if (isState(v)) return v; } catch { } return sampleState(); }
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); emit(); }
const emit = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT)); };
export const subscribe = fn => { window.addEventListener(EVT, fn); window.addEventListener('storage', fn); return () => { window.removeEventListener(EVT, fn); window.removeEventListener('storage', fn); }; };
export function reset() { localStorage.removeItem(KEY); localStorage.removeItem(BAG); emit(); }

export const money = n => 'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const uid = prefix => prefix + '-' + globalThis.crypto.randomUUID().slice(0, 8).toUpperCase();
export const img = path => '/' + path;

export function cart() { try { const b = JSON.parse(localStorage.getItem(BAG) || '[]'); return Array.isArray(b) ? b : []; } catch { return []; } }
export function setCart(items) { localStorage.setItem(BAG, JSON.stringify(items)); emit(); }
export function addToCart(id, option, qty = 1) {
  const b = cart(), line = b.find(i => i.id === id && i.option === option);
  if (line) line.qty = Math.min(10, line.qty + qty); else b.push({ id, option, qty });
  setCart(b);
}

export function quote(items, delivery = 'standard') {
  const state = load(); if (!Array.isArray(items) || !items.length) throw Error('Your bag is empty.');
  let total = 0; const totals = {};
  const lines = items.map(i => {
    const p = state.products.find(p => p.id === i.id);
    if (!p || !p.active) throw Error('A piece is no longer available. Please update your bag.');
    if (!p.options.includes(i.option) || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 10) throw Error('Please check your bag quantities and sizes.');
    totals[p.id] = (totals[p.id] || 0) + i.qty; total += p.price * i.qty;
    return { id: p.id, name: p.name, image: p.image, option: i.option, price: p.price, qty: i.qty };
  });
  for (const [id, n] of Object.entries(totals)) { const p = state.products.find(p => p.id === id); if (n > p.stock) throw Error(p.name + ': only ' + p.stock + ' available in the demo inventory.'); }
  if (!['standard', 'collection'].includes(delivery)) throw Error('Choose a delivery option.');
  const shipping = delivery === 'standard' ? SHIPPING : 0;
  return { lines, subtotal: total, shipping, total: total + shipping, delivery };
}
export function installment(total) { const cents = Math.round(total * 100), part = Math.floor(cents / 3); return [part / 100, part / 100, (cents - 2 * part) / 100]; }
export function attempt(method, outcome, total, token) { const s = load(); s.transactions.unshift({ id: uid('TX'), date: new Date().toISOString(), method, outcome, total, token, orderId: null }); save(s); }

export function place({ items, delivery, method, customer, token }) {
  if (!['online', 'cod', 'koko'].includes(method)) throw Error('Choose a payment method.');
  if (!token) throw Error('Checkout reference is missing. Please reload.');
  const s = load(), existing = s.orders.find(o => o.token === token); if (existing) return clone(existing);
  const q = quote(items, delivery);
  if (!customer || !customer.name?.trim() || !customer.email?.includes('@') || !customer.address?.trim()) throw Error('Complete the demo customer details.');
  const order = { id: uid('RZ'), date: new Date().toISOString(), token, ...q, method, customer: { name: customer.name.trim().slice(0, 80), email: customer.email.trim().toLowerCase().slice(0, 120), address: customer.address.trim().slice(0, 250), city: String(customer.city || '').slice(0, 80) }, status: 'Processing', payment: paymentFor(method, 'Processing'), source: 'checkout', reserved: true, installments: method === 'koko' ? installment(q.total) : null };
  for (const i of q.lines) s.products.find(p => p.id === i.id).stock -= i.qty;
  s.orders.unshift(order);
  s.transactions.unshift({ id: uid('TX'), date: order.date, method, outcome: method === 'cod' ? 'Awaiting cash' : 'Approved (mock)', total: q.total, token, orderId: order.id });
  localStorage.setItem(BAG, '[]'); save(s);
  return clone(order);
}

export function updateOrder(id, status, collect = false) {
  const s = load(), o = s.orders.find(o => o.id === id); if (!o) throw Error('Order not found.');
  const previousPayment = o.payment;
  if (!STATUSES.includes(status)) throw Error('Invalid order status.');
  if (o.status === 'Cancelled' && status !== 'Cancelled') throw Error('Cancelled orders cannot be reopened.');
  if (status === 'Cancelled' && o.status !== 'Cancelled') {
    if (o.reserved) for (const i of o.lines) { const p = s.products.find(p => p.id === i.id); if (p) p.stock += i.qty; }
    o.reserved = false;
    o.payment = o.method === 'cod' ? (o.payment === 'Collected (mock)' ? 'Refunded (mock)' : 'Cancelled') : 'Refunded (mock)';
  }
  o.status = status;
  if (collect) { if (o.method !== 'cod' || status !== 'Delivered') throw Error('Cash can only be marked collected for a delivered COD order.'); o.payment = 'Collected (mock)'; }
  if (o.payment !== previousPayment) s.transactions.unshift({ id: uid('TX'), date: new Date().toISOString(), method: o.method, outcome: o.payment, total: o.total, orderId: o.id });
  save(s); return o;
}

export function product(input) {
  const s = load();
  if (!input.name.trim() || input.name.length > 70) throw Error('Enter a product name under 70 characters.');
  if (!Number.isInteger(input.price) || input.price < 100 || input.price > 1000000) throw Error('Price must be a whole LKR amount between 100 and 1,000,000.');
  if (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > 999) throw Error('Stock must be from 0 to 999.');
  if (!CATEGORIES.includes(input.category)) throw Error('Choose a category.');
  if (!IMAGES.includes(input.image)) throw Error('Choose a sample image.');
  const p = s.products.find(p => p.id === input.id);
  if (p) Object.assign(p, { name: input.name.trim(), price: input.price, stock: input.stock, active: input.active, category: input.category, image: input.image });
  else s.products.push({ id: uid('piece').toLowerCase(), name: input.name.trim(), price: input.price, stock: input.stock, active: input.active, category: input.category, image: input.image, finish: 'Sample finish', tag: 'New arrival', description: 'A new sample piece in the ROMANZ collection. Photography and product details are illustrative.', options: input.category === 'rings' ? ['US 5', 'US 6', 'US 7', 'US 8', 'US 9'] : ['Standard'] });
  save(s);
}

export function sendMessage({ name, email, topic, body }) {
  if (!name?.trim() || !email?.includes('@') || !body?.trim()) throw Error('Please add your name, email and a message.');
  const s = load();
  s.messages.unshift({ id: uid('MSG'), date: new Date().toISOString(), name: name.trim().slice(0, 80), email: email.trim().slice(0, 120), topic: topic || 'General', body: body.trim().slice(0, 2000), read: false });
  save(s);
}
export function markRead(id, read = true) { const s = load(), m = s.messages.find(m => m.id === id); if (m) { m.read = read; save(s); } }
export function saveSettings(settings) { const s = load(); s.settings = { ...s.settings, ...settings }; save(s); }

export function customers(state = load()) {
  const map = new Map();
  for (const o of state.orders) {
    const c = map.get(o.customer.email) || { ...o.customer, orders: 0, spent: 0, last: o.date };
    c.orders++; if (o.status !== 'Cancelled') c.spent += o.total; if (o.date > c.last) c.last = o.date;
    map.set(o.customer.email, c);
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent);
}
