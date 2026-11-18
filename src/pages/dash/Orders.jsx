import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { useAuth, actorOf } from '../../lib/auth.jsx';
import { money, img, setStatus, nextStatuses, collectCash, addNote, bulkStatus, courierScan, STATUSES, trackLink } from '../../lib/store.js';
import { Badge, fmtDate, fmtTime, Icon, Timeline } from '../../components/ui.jsx';

const PAYMENTS = ['Awaiting payment', 'Paid (mock)', 'Plan approved (mock)', 'Due on delivery', 'Collected (mock)', 'Refunded (mock)', 'Cancelled'];
const ACTION = { Packed: 'Mark packed', Shipped: 'Ship…', 'Out for delivery': 'Out for delivery', Delivered: 'Mark delivered', Confirmed: 'Back to confirmed', Cancelled: 'Cancel & refund', Returned: 'Record return' };

export default function Orders() {
  const { data } = useStore(), { user } = useAuth(), actor = actorOf(user);
  const [q, setQ] = useState(''), [status, setStatusF] = useState('All'), [pay, setPay] = useState('all'), [method, setMethod] = useState('all'), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [params, setParams] = useSearchParams(), openId = params.get('open'), setOpenId = id => setParams(id ? { open: id } : {}, { replace: true });
  const [picked, setPicked] = useState([]), [bulkMsg, setBulkMsg] = useState('');
  const list = data.orders.filter(o => (status === 'All' || o.status === status) && (pay === 'all' || o.payment === pay) && (method === 'all' || o.method === method)
    && (!from || o.date.slice(0, 10) >= from) && (!to || o.date.slice(0, 10) <= to)
    && (o.id + o.customer.name + o.customer.email + (o.customer.phone || '') + (o.shipment?.tracking || '')).toLowerCase().includes(q.toLowerCase()));
  const o = data.orders.find(o => o.id === openId);
  const toggle = id => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const bulk = s => { const errs = bulkStatus(picked, s, actor); setBulkMsg(errs.length ? `${picked.length - errs.length} updated, ${errs.length} skipped: ${errs[0]}` : `${picked.length} order(s) marked ${s.toLowerCase()}.`); setPicked([]); };
  const exportCsv = () => {
    const rows = [['order', 'date', 'customer', 'email', 'phone', 'city', 'status', 'payment', 'method', 'total', 'courier', 'tracking'], ...list.map(o => [o.id, o.date, o.customer.name, o.customer.email, o.customer.phone, o.customer.city, o.status, o.payment, o.method, o.total, o.shipment?.courier || '', o.shipment?.tracking || ''])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })); a.download = 'romanz-orders.csv'; a.click();
  };
  const count = s => data.orders.filter(o => o.status === s).length;
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Orders</h1><p className="muted">{data.orders.length} orders · {count('Confirmed')} to pack · {count('Packed')} to ship · {count('Pending payment')} awaiting payment</p></div><button className="btn sm ghost" onClick={exportCsv}>Export CSV</button></div>
      <div className="toolbar">
        <div className="chips">{['All', ...STATUSES].map(s => <button key={s} className={'chip' + (status === s ? ' on' : '')} onClick={() => setStatusF(s)}>{s} <small>{s === 'All' ? data.orders.length : count(s)}</small></button>)}</div>
      </div>
      <div className="toolbar">
        <label className="search"><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Order, name, phone, tracking no." aria-label="Search orders" /></label>
        <div className="row wrap">
          <select value={pay} onChange={e => setPay(e.target.value)} aria-label="Payment status"><option value="all">Any payment</option>{PAYMENTS.map(p => <option key={p}>{p}</option>)}</select>
          <select value={method} onChange={e => setMethod(e.target.value)} aria-label="Method"><option value="all">Any method</option><option value="online">Card</option><option value="cod">COD</option><option value="koko">Koko</option></select>
          <input type="date" className="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="From date" />
          <input type="date" className="date" value={to} onChange={e => setTo(e.target.value)} aria-label="To date" />
        </div>
      </div>
      {picked.length > 0 && <div className="bulkbar"><b>{picked.length} selected</b><button className="btn sm" onClick={() => bulk('Packed')}>Mark packed</button><button className="btn sm ghost" onClick={() => window.open('/dashboard/slips?ids=' + picked.join(','), '_blank')}>Print packing slips</button><button className="link" onClick={() => setPicked([])}>Clear</button></div>}
      {bulkMsg && <p className="notice ok" onClick={() => setBulkMsg('')}>{bulkMsg}</p>}
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th><input type="checkbox" aria-label="Select all" checked={list.length > 0 && list.slice(0, 200).every(o => picked.includes(o.id))} onChange={e => setPicked(e.target.checked ? list.slice(0, 200).map(o => o.id) : [])} /></th><th>Order</th><th>Customer</th><th>Date</th><th>Method</th><th>Payment</th><th>Status</th><th className="num">Total</th></tr></thead>
        <tbody>{list.slice(0, 200).map(o => <tr key={o.id} className="clickable" onClick={() => setOpenId(o.id)}>
          <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={'Select ' + o.id} checked={picked.includes(o.id)} onChange={() => toggle(o.id)} /></td>
          <td><b>{o.id}</b>{o.note && <span title="Gift note"> 🎁</span>}</td><td>{o.customer.name}<br /><small className="muted">{o.customer.city}</small></td><td>{fmtDate(o.date)}</td><td className="caps">{o.method}</td><td className="small">{o.payment}</td><td><Badge>{o.status}</Badge></td><td className="num">{money(o.total)}</td></tr>)}</tbody>
      </table>{!list.length && <p className="empty">No orders match.</p>}</div></div>
      {o && <OrderDrawer o={o} actor={actor} couriers={data.settings.couriers} close={() => setOpenId(null)} />}
    </div>
  );
}

function OrderDrawer({ o, actor, couriers, close }) {
  const [error, setError] = useState(''), [ship, setShip] = useState(null), [note, setNote] = useState(''), [reason, setReason] = useState('');
  const next = nextStatuses(o, actor);
  const act = (s, opts) => { setError(''); try { setStatus(o.id, s, opts, actor); setShip(null); setReason(''); } catch (e) { setError(e.message); } };
  const run = fn => { setError(''); try { fn(); } catch (e) { setError(e.message); } };
  return (
    <div className="drawer-wrap" onClick={close}>
      <aside className="drawer" onClick={e => e.stopPropagation()} role="dialog" aria-label={'Order ' + o.id}>
        <div className="card-head"><h2>{o.id}</h2><button className="icon-btn" onClick={close} aria-label="Close"><Icon name="close" /></button></div>
        <p className="muted small">{fmtTime(o.date)} · <Badge>{o.status}</Badge> · {o.payment}</p>
        {o.expiresAt && <p className="notice err small">Unpaid. Reservation ends {fmtTime(o.expiresAt)}, then the expiry job cancels it automatically.</p>}

        {next.length > 0 && <>
          <h4>Next step</h4>
          <div className="row wrap">
            {next.filter(s => !['Cancelled', 'Returned'].includes(s)).map(s => <button key={s} className={'btn sm' + (s === 'Confirmed' ? ' ghost' : '')} onClick={() => s === 'Shipped' ? setShip({ courier: couriers[0].name, tracking: '' }) : act(s)}>{ACTION[s]}</button>)}
          </div>
          {ship && <form className="ship-box" onSubmit={e => { e.preventDefault(); act('Shipped', ship); }}>
            <label>Courier<select value={ship.courier} onChange={e => setShip({ ...ship, courier: e.target.value })}>{couriers.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
            <label>Tracking number<input value={ship.tracking} onChange={e => setShip({ ...ship, tracking: e.target.value.toUpperCase() })} placeholder="e.g. LK700123456" autoFocus /></label>
            <p className="muted small">The customer gets an email{o.customer.phone ? ' and SMS' : ''} with the tracking link.</p>
            <div className="row"><button className="btn sm">Confirm shipment</button><button type="button" className="link" onClick={() => setShip(null)}>Cancel</button></div>
          </form>}
          {next.some(s => ['Cancelled', 'Returned'].includes(s)) && <div className="ship-box">
            <label>Reason (shown to the customer)<input value={reason} onChange={e => setReason(e.target.value)} placeholder={o.status === 'Delivered' || o.status === 'Shipped' ? 'e.g. Exchanged for another size' : 'e.g. Customer asked to cancel'} /></label>
            <div className="row">{next.filter(s => ['Cancelled', 'Returned'].includes(s)).map(s => <button key={s} className="btn sm danger" onClick={() => confirm(`${ACTION[s]} for ${o.id}? Stock goes back and the payment is refunded (mock).`) && act(s, { note: reason })}>{ACTION[s]}</button>)}</div>
          </div>}
        </>}
        {o.method === 'cod' && o.status === 'Delivered' && o.payment === 'Due on delivery' && <div className="row"><button className="btn sm" onClick={() => run(() => collectCash(o.id, actor))}>Mark cash collected</button></div>}
        {!next.some(s => ['Cancelled', 'Returned'].includes(s)) && !['Cancelled', 'Returned'].includes(o.status) && actor.role === 'staff' && <p className="muted small">Cancellations and returns need a manager.</p>}
        {error && <p className="notice err">{error}</p>}

        <h4>Customer</h4><p>{o.customer.name}<br /><span className="muted">{o.customer.email}{o.customer.phone && ' · ' + o.customer.phone}<br />{o.delivery === 'standard' ? o.customer.address + ', ' + o.customer.city : 'Studio collection'}</span></p>
        {o.note && <p className="notice ok small">Gift note: “{o.note}”</p>}
        <h4>Items</h4>
        <ul className="mini-lines">{o.lines.map((l, i) => <li key={i}><img src={img(l.image)} alt="" /><span>{l.name}<small>{l.option} · {l.sku} × {l.qty}</small></span><b>{money(l.price * l.qty)}</b></li>)}</ul>
        {o.discount > 0 && <div className="sum-row"><span>Discount ({o.code})</span><span>−{money(o.discount)}</span></div>}
        <div className="sum-row"><span>Delivery ({o.delivery})</span><span>{money(o.shipping)}</span></div>
        <div className="sum-row total"><span>Total</span><span>{money(o.total)}</span></div>
        {o.installments && <p className="muted small">Instalments: {o.installments.map(money).join(' · ')}</p>}
        {['Shipped', 'Out for delivery'].includes(o.status) && o.shipment && <div className="ship-box sim">
          <p className="small"><b>Courier simulator</b>: pretend {o.shipment.courier}’s system sent a status update.</p>
          <div className="row wrap">{[['hub', 'Arrived at hub'], ['out', 'Out for delivery'], ['failed', 'Failed attempt'], ['delivered', 'Delivered']].filter(([k]) => !(k === 'out' && o.status === 'Out for delivery')).map(([k, l]) => <button key={k} className="btn sm ghost" onClick={() => run(() => courierScan(o.id, k))}>{l}</button>)}</div>
        </div>}
        {o.refunded > 0 && <p className="small">Refunded so far: <b>{money(o.refunded)}</b></p>}
        {o.shipment && <p className="small">Shipped with <b>{o.shipment.courier}</b> · {o.shipment.tracking}{o.shipment.url && <> · <a className="link" href={o.shipment.url} target="_blank" rel="noreferrer">courier page ↗</a></>}</p>}
        <div className="row wrap"><Link className="btn sm ghost" to={'/dashboard/slips?ids=' + o.id} target="_blank"><Icon name="print" size={14} /> Packing slip</Link><Link className="btn sm ghost" to={trackLink(o)} target="_blank">Customer tracking page</Link></div>

        <h4>Timeline</h4>
        <Timeline order={o} all />
        <h4>Internal notes</h4>
        <form className="row" onSubmit={e => { e.preventDefault(); run(() => { addNote(o.id, note, actor); setNote(''); }); }}><input value={note} onChange={e => setNote(e.target.value)} placeholder="Only the team sees this" /><button className="btn sm">Add</button></form>
        <ul className="events">{o.notes.map((n, i) => <li key={i} className="internal"><b>{n.text}</b><small>{fmtTime(n.date)} · {n.by}</small></li>)}</ul>
      </aside>
    </div>
  );
}

// Printable packing slips + address labels. Opened in a new tab from the orders page.
export function Slips() {
  const { data } = useStore(), ids = new URLSearchParams(location.search).get('ids')?.split(',') || [];
  const orders = data.orders.filter(o => ids.includes(o.id));
  return (
    <div className="slips">
      <div className="no-print row"><button className="btn sm" onClick={() => print()}>Print {orders.length} slip(s)</button><span className="muted small">Each slip prints on its own page.</span></div>
      {orders.map(o => (
        <section key={o.id} className="slip">
          <div className="slip-head"><div className="brand"><img src="/logo.png" alt="" width="40" height="40" /><span>ROMANZ<small>JEWELLERY</small></span></div><div className="right"><b>{o.id}</b><br /><small>{fmtDate(o.date)}</small></div></div>
          <div className="slip-grid">
            <div className="label-box"><small>SHIP TO</small><b>{o.customer.name}</b><span>{o.delivery === 'standard' ? o.customer.address : 'STUDIO COLLECTION'}</span><span>{o.delivery === 'standard' ? o.customer.city : '42 Flower Road, Colombo 07'}</span><span>{o.customer.phone}</span>{o.method === 'cod' && o.payment === 'Due on delivery' && <b className="cod">COLLECT {money(o.total)} (COD)</b>}{o.shipment && <span>{o.shipment.courier} · {o.shipment.tracking}</span>}</div>
            <div><small>FROM</small><p>ROMANZ Jewellery<br />42 Flower Road, Colombo 07<br />{data.settings.supportPhone}</p></div>
          </div>
          <table><thead><tr><th>SKU</th><th>Piece</th><th>Option</th><th className="num">Qty</th><th>✓</th></tr></thead>
            <tbody>{o.lines.map((l, i) => <tr key={i}><td>{l.sku}</td><td>{l.name}</td><td>{l.option}</td><td className="num">{l.qty}</td><td>☐</td></tr>)}</tbody></table>
          {o.note && <div className="gift"><small>GIFT NOTE: write on card</small><p>“{o.note}”</p></div>}
          <p className="small">Thank you for choosing ROMANZ. Track your order at romanz.lk/track · Returns within 14 days on unworn pieces.</p>
        </section>
      ))}
      {!orders.length && <p className="empty">No orders selected.</p>}
    </div>
  );
}
