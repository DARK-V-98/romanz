import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { useAuth, actorOf, can } from '../../lib/auth.jsx';
import { money, img, decideReturn, receiveReturn, moderateReview, replyReview, markNotices, customers, isRevenue, RETURN_STATUSES } from '../../lib/store.js';
import { Badge, Icon, Stars, fmtDate, fmtTime } from '../../components/ui.jsx';

/* ---------------------------------------------------------------- Returns & exchanges */
export function Returns() {
  const { data } = useStore(), { user } = useAuth(), actor = actorOf(user), manager = can(user, 'payments');
  const [status, setStatus] = useState('requested'), [openId, setOpenId] = useState(null), [note, setNote] = useState(''), [error, setError] = useState('');
  const list = data.returns.filter(r => status === 'all' || r.status === status), r = data.returns.find(r => r.id === openId);
  const o = r && data.orders.find(o => o.id === r.orderId);
  const run = fn => { setError(''); try { fn(); setNote(''); } catch (e) { setError(e.message); } };
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Returns & exchanges</h1><p className="muted">Customers request these from their account within {data.settings.returnDays} days of delivery. Managers approve; anyone in the team can check a parcel in.</p></div></div>
      <div className="toolbar"><div className="chips">{['all', ...RETURN_STATUSES].map(s => <button key={s} className={'chip' + (status === s ? ' on' : '')} onClick={() => setStatus(s)}>{s} <small>{s === 'all' ? data.returns.length : data.returns.filter(r => r.status === s).length}</small></button>)}</div></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Request</th><th>Order</th><th>Customer</th><th>Type</th><th>Reason</th><th>Status</th><th className="num">Refund</th></tr></thead>
        <tbody>{list.map(r => <tr key={r.id} className="clickable" onClick={() => { setOpenId(r.id); setError(''); }}><td><b>{r.id}</b><br /><small className="muted">{fmtDate(r.date)}</small></td><td>{r.orderId}</td><td>{r.name}</td><td className="caps">{r.type}</td><td>{r.reason}</td><td><span className={'badge rs-' + r.status}>{r.status}</span></td><td className="num">{r.refund ? money(r.refund) : '—'}</td></tr>)}</tbody>
      </table>{!list.length && <p className="empty">No {status === 'all' ? '' : status} returns. Customers can request one from My account once an order is delivered.</p>}</div></div>
      {r && <div className="drawer-wrap" onClick={() => setOpenId(null)}><aside className="drawer" onClick={e => e.stopPropagation()}>
        <div className="card-head"><h2>{r.id}</h2><button className="icon-btn" onClick={() => setOpenId(null)} aria-label="Close"><Icon name="close" /></button></div>
        <p className="muted small">{fmtTime(r.date)} · <span className={'badge rs-' + r.status}>{r.status}</span> · <span className="caps">{r.type}</span></p>
        <p>{r.name} · {r.email}<br /><span className="muted">Order <Link className="link" to={'/dashboard/orders?open=' + r.orderId}>{r.orderId}</Link> · {o?.payment}</span></p>
        <h4>Pieces</h4>
        <ul className="mini-lines">{r.items.map(i => { const l = o.lines.find(l => l.sku === i.sku); return <li key={i.sku}><img src={img(l.image)} alt="" /><span>{l.name}<small>{l.option}{i.toOption && ' → ' + i.toOption} × {i.qty}</small></span><b>{money(l.price * i.qty)}</b></li>; })}</ul>
        <p className="small"><b>Reason:</b> {r.reason}{r.note && <><br /><span className="muted">“{r.note}”</span></>}</p>
        {r.label && <p className="small">Return label: <b>{r.label}</b></p>}
        {r.exchangeOrderId && <p className="small">Replacement order: <Link className="link" to={'/dashboard/orders?open=' + r.exchangeOrderId}>{r.exchangeOrderId}</Link></p>}
        {r.status === 'requested' && (manager ? <div className="ship-box">
          <label>Note to customer (required to reject)<input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Worn pieces can’t be returned" /></label>
          <div className="row"><button className="btn sm" onClick={() => run(() => decideReturn(r.id, 'approved', note, actor))}>Approve & send label</button><button className="btn sm danger" onClick={() => run(() => decideReturn(r.id, 'rejected', note, actor))}>Reject</button></div>
        </div> : <p className="muted small">A manager needs to approve this request.</p>)}
        {r.status === 'approved' && <div className="ship-box"><p className="small">When the parcel arrives, check the pieces are unworn, then:</p><button className="btn sm" onClick={() => run(() => receiveReturn(r.id, actor))}>{r.type === 'exchange' ? 'Received: send the new size' : 'Received: refund ' + money(r.items.reduce((a, i) => a + o.lines.find(l => l.sku === i.sku).price * i.qty, 0) * (o.discount ? 1 - o.discount / o.subtotal : 1))}</button></div>}
        {error && <p className="notice err">{error}</p>}
        <h4>History</h4>
        <ul className="events">{r.log.map((x, i) => <li key={i}><b>{x.text}</b><small>{fmtTime(x.date)}</small></li>)}</ul>
      </aside></div>}
    </div>
  );
}

/* ---------------------------------------------------------------- Review moderation */
export function Reviews() {
  const { data } = useStore(), { user } = useAuth(), actor = actorOf(user);
  const [status, setStatus] = useState('pending'), [reply, setReply] = useState({}), [error, setError] = useState('');
  const list = data.reviews.filter(r => status === 'all' || r.status === status);
  const names = Object.fromEntries(data.products.map(p => [p.id, p]));
  const published = data.reviews.filter(r => r.status === 'published'), avg = published.length ? (published.reduce((a, r) => a + r.rating, 0) / published.length).toFixed(1) : '—';
  const run = fn => { setError(''); try { fn(); } catch (e) { setError(e.message); } };
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Reviews</h1><p className="muted">New reviews wait here until approved. Verified = the same email received this piece.</p></div></div>
      <div className="kpis"><div className="kpi"><span>Average rating</span><b>{avg} ★</b></div><div className="kpi"><span>Published</span><b>{published.length}</b></div><div className="kpi"><span>Waiting</span><b>{data.reviews.filter(r => r.status === 'pending').length}</b></div><div className="kpi"><span>Verified share</span><b>{published.length ? Math.round(published.filter(r => r.verified).length / published.length * 100) : 0}%</b></div></div>
      <div className="toolbar"><div className="chips">{['pending', 'published', 'hidden', 'all'].map(s => <button key={s} className={'chip' + (status === s ? ' on' : '')} onClick={() => setStatus(s)}>{s} <small>{s === 'all' ? data.reviews.length : data.reviews.filter(r => r.status === s).length}</small></button>)}</div></div>
      {error && <p className="notice err">{error}</p>}
      <div className="stack">{list.map(r => <div key={r.id} className="card review-mod">
        <div className="row spread"><span className="cell-img">{names[r.productId] && <img src={img(names[r.productId].image)} alt="" />}<span><b>{names[r.productId]?.name || r.productId}</b><br /><small className="muted">{r.name} · {r.email} · {fmtDate(r.date)}{r.verified && ' · ✓ verified buyer'}</small></span></span><Stars value={r.rating} size={16} /></div>
        {r.title && <h4 className="rtitle">{r.title}</h4>}<p>{r.body}</p>
        {r.reply && <div className="reply"><small className="muted">Reply by {r.reply.by}</small><p>{r.reply.body}</p></div>}
        <div className="row wrap">
          {r.status !== 'published' && <button className="btn sm" onClick={() => run(() => moderateReview(r.id, 'published', actor))}>Publish</button>}
          {r.status !== 'hidden' && <button className="btn sm ghost" onClick={() => run(() => moderateReview(r.id, 'hidden', actor))}>Hide</button>}
          <input className="grow" value={reply[r.id] ?? ''} onChange={e => setReply({ ...reply, [r.id]: e.target.value })} placeholder={r.reply ? 'Edit public reply…' : 'Public reply (optional)…'} aria-label="Reply" />
          <button className="btn sm ghost" disabled={!reply[r.id]?.trim()} onClick={() => run(() => { replyReview(r.id, reply[r.id], actor); setReply({ ...reply, [r.id]: '' }); })}>Reply</button>
        </div>
      </div>)}{!list.length && <p className="empty">No {status} reviews.</p>}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- Reports */
const DAY = 86400000;
const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '12 months']];
export function Reports() {
  const { data } = useStore(), [days, setDays] = useState(30);
  const r = useMemo(() => {
    const now = Date.now(), from = now - days * DAY, prevFrom = from - days * DAY;
    const inR = (o, a, b) => { const t = new Date(o.date).getTime(); return t >= a && t < b; };
    const cur = data.orders.filter(o => inR(o, from, now + 1)), prev = data.orders.filter(o => inR(o, prevFrom, from));
    const net = list => list.filter(isRevenue).reduce((a, o) => a + o.total - (o.refunded || 0), 0);
    const paid = cur.filter(isRevenue), units = paid.reduce((a, o) => a + o.lines.reduce((x, l) => x + l.qty, 0), 0);
    const refunds = cur.reduce((a, o) => a + (o.refunded || 0) + (['Cancelled', 'Returned'].includes(o.status) && o.payment === 'Refunded (mock)' ? o.total - (o.refunded || 0) : 0), 0);
    const byCust = new Map(); for (const o of paid) byCust.set(o.customer.email, (byCust.get(o.customer.email) || 0) + 1);
    const repeat = byCust.size ? Math.round([...byCust.values()].filter(n => n > 1).length / byCust.size * 100) : 0;
    const step = days <= 30 ? DAY : days <= 90 ? 7 * DAY : 30 * DAY, n = Math.ceil(days * DAY / step);
    const buckets = Array.from({ length: n }, (_, i) => { const a = from + i * step, b = a + step; return { label: step === DAY ? new Date(a).getDate() : new Date(a).toLocaleDateString('en-GB', step > 7 * DAY ? { month: 'short' } : { day: 'numeric', month: 'short' }), total: net(cur.filter(o => inR(o, a, b))) }; });
    const prod = new Map(); for (const o of paid) for (const l of o.lines) { const x = prod.get(l.id) || { id: l.id, name: l.name, image: l.image, units: 0, revenue: 0 }; x.units += l.qty; x.revenue += l.price * l.qty; prod.set(l.id, x); }
    const cities = new Map(); for (const o of paid) cities.set(o.customer.city || '—', (cities.get(o.customer.city || '—') || 0) + o.total);
    const methods = ['online', 'cod', 'koko'].map(m => [m, net(paid.filter(o => o.method === m))]);
    const statuses = ['Confirmed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled', 'Returned'].map(s => [s, cur.filter(o => o.status === s).length]);
    return { cur, prev, revenue: net(cur), prevRevenue: net(prev), orders: paid.length, prevOrders: prev.filter(isRevenue).length, units, refunds, discount: paid.reduce((a, o) => a + (o.discount || 0), 0), repeat, cancel: cur.length ? Math.round(cur.filter(o => o.status === 'Cancelled').length / cur.length * 100) : 0, buckets, top: [...prod.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8), cities: [...cities].sort((a, b) => b[1] - a[1]).slice(0, 6), methods, statuses };
  }, [data, days]);
  const delta = (a, b) => b ? Math.round((a - b) / b * 100) : null;
  const max = Math.max(...r.buckets.map(b => b.total), 1), mMax = Math.max(...r.methods.map(m => m[1]), 1), cMax = Math.max(...r.cities.map(c => c[1]), 1);
  const kpis = [['Net revenue', money(r.revenue), delta(r.revenue, r.prevRevenue)], ['Paid orders', r.orders, delta(r.orders, r.prevOrders)], ['Average order', money(r.orders ? Math.round(r.revenue / r.orders) : 0), null], ['Pieces sold', r.units, null], ['Refunded', money(r.refunds), null], ['Discounts given', money(r.discount), null], ['Repeat customers', r.repeat + '%', null], ['Cancellation rate', r.cancel + '%', null]];
  const exportCsv = () => { const rows = [['piece', 'units', 'revenue'], ...r.top.map(p => [p.name, p.units, p.revenue])]; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(x => x.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })); a.download = `romanz-top-products-${days}d.csv`; a.click(); };
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Reports</h1><p className="muted">Net of refunds. Compared with the {days} days before.</p></div><div className="chips">{RANGES.map(([d, l]) => <button key={d} className={'chip' + (days === d ? ' on' : '')} onClick={() => setDays(d)}>{l}</button>)}</div></div>
      <div className="kpis">{kpis.map(([l, v, d]) => <div key={l} className="kpi"><span>{l}</span><b>{v}</b>{d !== null && <small className={d >= 0 ? 'up' : 'down'}>{d >= 0 ? '▲' : '▼'} {Math.abs(d)}%</small>}</div>)}</div>
      <div className="dash-grid">
        <section className="card wide"><h3>Net revenue</h3>
          <div className="bars" role="img" aria-label={'Revenue over the last ' + days + ' days'}>{r.buckets.map((b, i) => <div key={i} className="bar-col" title={b.label + ': ' + money(b.total)}><div className="bar" style={{ height: (b.total / max * 100) + '%' }} /><span>{r.buckets.length > 16 && i % 3 ? '' : b.label}</span></div>)}</div>
        </section>
        <section className="card"><h3>By payment method</h3>{r.methods.map(([m, v]) => <div key={m} className="hbar"><span>{m === 'online' ? 'Card' : m === 'cod' ? 'COD' : 'Koko'}</span><div><i style={{ width: (v / mMax * 100) + '%' }} /></div><b>{money(v)}</b></div>)}
          <h3 className="mt">Top cities</h3>{r.cities.map(([c, v]) => <div key={c} className="hbar"><span>{c}</span><div><i style={{ width: (v / cMax * 100) + '%' }} /></div><b>{money(v)}</b></div>)}</section>
        <section className="card wide"><div className="card-head"><h3>Top pieces</h3><button className="link" onClick={exportCsv}>Export CSV</button></div>
          <div className="table-wrap"><table><thead><tr><th>Piece</th><th className="num">Units</th><th className="num">Revenue</th><th className="num">Share</th></tr></thead>
            <tbody>{r.top.map(p => <tr key={p.id}><td><span className="cell-img"><img src={img(p.image)} alt="" /><b>{p.name}</b></span></td><td className="num">{p.units}</td><td className="num">{money(p.revenue)}</td><td className="num">{r.revenue ? Math.round(p.revenue / r.revenue * 100) : 0}%</td></tr>)}</tbody></table>{!r.top.length && <p className="empty">No paid orders in this range.</p>}</div></section>
        <section className="card"><h3>Order status</h3>{r.statuses.map(([s, n]) => <div key={s} className="sum-row"><Badge>{s}</Badge><b>{n}</b></div>)}<p className="muted small">{customers(data).length} customers all-time.</p></section>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Notification bell + toasts */
export function NotificationBell() {
  const { data } = useStore(), { user } = useAuth(), nav = useNavigate(), [open, setOpen] = useState(false), [toast, setToast] = useState(null);
  const mine = data.notices.filter(n => visible(user, n)), unread = mine.filter(n => !n.readBy.includes(user.id));
  const latest = useRef(mine[0]?.id);
  useEffect(() => {
    if (mine[0] && latest.current && mine[0].id !== latest.current && !mine[0].readBy.includes(user.id)) { setToast(mine[0]); const t = setTimeout(() => setToast(null), 6000); latest.current = mine[0].id; return () => clearTimeout(t); }
    latest.current = mine[0]?.id;
  }, [mine[0]?.id]);
  const go = n => { markNotices(user.id, [n.id]); setOpen(false); setToast(null); nav(n.link); };
  return (
    <div className="bell-wrap">
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={'Notifications, ' + unread.length + ' unread'} aria-expanded={open}><Icon name="bell" />{unread.length > 0 && <span className="bell-dot">{unread.length > 9 ? '9+' : unread.length}</span>}</button>
      {open && <div className="bell-menu" role="menu">
        <div className="card-head"><b>Notifications</b>{unread.length > 0 && <button className="link" onClick={() => markNotices(user.id, unread.map(n => n.id))}>Mark all read</button>}</div>
        {mine.slice(0, 12).map(n => <button key={n.id} role="menuitem" className={'bell-item' + (n.readBy.includes(user.id) ? '' : ' unread')} onClick={() => go(n)}><span>{n.text}</span><small>{fmtTime(n.date)}</small></button>)}
        {!mine.length && <p className="muted small">Nothing yet. New orders, payments, messages, reviews and returns appear here.</p>}
      </div>}
      {toast && <button className="toast" onClick={() => go(toast)} role="status"><Icon name="bell" size={16} /> {toast.text}</button>}
    </div>
  );
}
const NOTICE_PERM = { order: 'orders', payment: 'orders', courier: 'orders', return: 'orders', message: 'inbox', review: 'products', alert: 'products' };
const visible = (user, n) => can(user, NOTICE_PERM[n.type] || 'overview');

/* ---------------------------------------------------------------- Command palette (Ctrl/⌘ + K) */
const PAGES = [['Overview', '/dashboard', 'overview'], ['Orders', '/dashboard/orders', 'orders'], ['Returns', '/dashboard/returns', 'orders'], ['Products', '/dashboard/products', 'products'], ['New product', '/dashboard/products?new=1', 'products'], ['Import CSV', '/dashboard/products?tab=import', 'products'], ['Inventory log', '/dashboard/products?tab=inventory', 'products'], ['Waitlist', '/dashboard/products?tab=waitlist', 'products'], ['Reviews', '/dashboard/reviews', 'products'], ['Discounts', '/dashboard/discounts', 'products'], ['Customers', '/dashboard/customers', 'customers'], ['Reports', '/dashboard/reports', 'customers'], ['Payments', '/dashboard/payments', 'payments'], ['Inbox', '/dashboard/inbox', 'inbox'], ['Outbox', '/dashboard/outbox', 'inbox'], ['Team & roles', '/dashboard/team', 'team'], ['Settings', '/dashboard/settings', 'settings'], ['View store', '/', 'overview']];
export function CommandPalette() {
  const { data } = useStore(), { user } = useAuth(), nav = useNavigate(), [open, setOpen] = useState(false), [q, setQ] = useState(''), [i, setI] = useState(0), input = useRef();
  useEffect(() => {
    const k = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); setQ(''); setI(0); } if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 0); }, [open]);
  const t = q.trim().toLowerCase();
  const results = [
    ...PAGES.filter(([l, , p]) => can(user, p) && (!t || l.toLowerCase().includes(t))).map(([l, to]) => ({ kind: 'Go to', label: l, to })),
    ...(t.length > 1 && can(user, 'orders') ? data.orders.filter(o => (o.id + ' ' + o.customer.name + ' ' + o.customer.email + ' ' + (o.shipment?.tracking || '')).toLowerCase().includes(t)).slice(0, 6).map(o => ({ kind: 'Order', label: `${o.id} · ${o.customer.name} · ${o.status}`, to: '/dashboard/orders?open=' + o.id })) : []),
    ...(t.length > 1 && can(user, 'products') ? data.products.filter(p => (p.name + ' ' + p.variants.map(v => v.sku).join(' ')).toLowerCase().includes(t)).slice(0, 5).map(p => ({ kind: 'Product', label: `${p.name} · ${p.stock} in stock`, to: '/dashboard/products?edit=' + p.id })) : []),
    ...(t.length > 1 && can(user, 'customers') ? customers(data).filter(c => (c.name + ' ' + c.email).toLowerCase().includes(t)).slice(0, 4).map(c => ({ kind: 'Customer', label: `${c.name} · ${c.email}`, to: '/dashboard/customers?open=' + encodeURIComponent(c.email) })) : [])
  ].slice(0, 14);
  const go = r => { setOpen(false); nav(r.to); };
  if (!open) return <button className="palette-hint" onClick={() => setOpen(true)} title="Search everything (Ctrl/⌘ K)"><Icon name="search" size={14} /> Search <kbd>Ctrl K</kbd></button>;
  return (
    <div className="modal palette-wrap" onClick={() => setOpen(false)}>
      <div className="palette" onClick={e => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input ref={input} value={q} onChange={e => { setQ(e.target.value); setI(0); }} placeholder="Search orders, products, customers or jump to a page…" aria-label="Search"
          onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(i + 1, results.length - 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(i - 1, 0)); } if (e.key === 'Enter' && results[i]) go(results[i]); }} />
        <ul>{results.map((r, j) => <li key={r.kind + r.to}><button className={j === i ? 'on' : ''} onMouseEnter={() => setI(j)} onClick={() => go(r)}><small>{r.kind}</small>{r.label}</button></li>)}</ul>
        {!results.length && <p className="muted small">No matches for “{q}”.</p>}
        <p className="muted small palette-foot">↑↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  );
}
