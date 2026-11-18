import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { useAuth } from '../../lib/auth.jsx';
import { money, img, updateProfile, saveAddress, removeAddress, trackLink, isRevenue, returnWindow, requestReturn, variantOf } from '../../lib/store.js';
import { Badge, Timeline, fmtDate } from '../../components/ui.jsx';

export default function Account() {
  const { data } = useStore(), { user, logout } = useAuth(), [tab, setTab] = useState('orders'), [ret, setRet] = useState(null);
  const orders = data.orders.filter(o => o.userId === user.id || o.customer.email === user.email);
  const spent = orders.filter(isRevenue).reduce((a, o) => a + o.total - (o.refunded || 0), 0);
  const tier = spent > 150000 ? 'Gold' : spent > 60000 ? 'Rose' : 'Ivory';
  const open = orders.filter(o => !['Delivered', 'Cancelled', 'Returned'].includes(o.status)).length;
  return (
    <div className="page">
      <div className="acct-head">
        <div><p className="eyebrow">My account</p><h1>Hello, <em>{user.name.split(' ')[0]}.</em></h1></div>
        <button className="btn ghost" onClick={logout}>Sign out</button>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Orders</span><b>{orders.length}</b></div>
        <div className="kpi"><span>On the way</span><b>{open}</b></div>
        <div className="kpi"><span>Total spent</span><b>{money(spent)}</b></div>
        <div className="kpi"><span>Circle tier · points</span><b>{tier} · {Math.floor(spent / 100)}</b></div>
      </div>
      <div className="chips">{[['orders', 'Orders'], ['profile', 'Profile'], ['addresses', 'Addresses']].map(([k, l]) => <button key={k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'orders' && (orders.length ? <div className="stack">{orders.map((o, i) => (
        <details key={o.id} className="panel order-card" open={i === 0}>
          <summary><span><b>{o.id}</b><small className="muted"> · {fmtDate(o.date)}</small></span><span className="row"><Badge>{o.status}</Badge><b>{money(o.total)}</b></span></summary>
          <Timeline order={o} />
          {o.shipment && <p className="small">Courier: <b>{o.shipment.courier}</b> · {o.shipment.tracking}{o.shipment.url && <> · <a className="link" href={o.shipment.url} target="_blank" rel="noreferrer">Track with courier ↗</a></>}</p>}
          <ul className="mini-lines">{o.lines.map((l, i) => <li key={i}><img src={img(l.image)} alt="" /><span>{l.name}<small>{l.option} × {l.qty}</small></span><b>{money(l.price * l.qty)}</b></li>)}</ul>
          <p className="muted small">{o.delivery === 'standard' ? 'Delivery to ' + o.customer.city : 'Studio collection'} · <span className="caps">{o.method}</span> · {o.payment}</p>
          {data.returns.filter(r => r.orderId === o.id).map(r => <p key={r.id} className="notice ok small"><b>{r.id}</b> · {r.type} · {r.status}{r.label && r.status === 'approved' && <> · return label <b>{r.label}</b></>}{r.refund > 0 && <> · refunded {money(r.refund)}</>}{r.exchangeOrderId && <> · new order {r.exchangeOrderId}</>}</p>)}
          <div className="row wrap">
            {returnWindow(o, data).ok && <button className="btn sm ghost" onClick={() => setRet(o)}>Return or exchange</button>}
            {o.status === 'Pending payment' && <Link className="btn sm" to={'/pay/' + o.id + '?t=' + o.trackToken}>Complete payment</Link>}
            <Link className="btn sm ghost" to={trackLink(o)}>Tracking page</Link>
            <Link className="btn sm ghost" to="/contact" state={{ orderId: o.id }}>Get help</Link>
          </div>
        </details>
      ))}</div> : <div className="empty">No orders yet. <Link to="/shop">Find your first piece →</Link></div>)}
      {ret && <ReturnForm o={ret} data={data} close={() => setRet(null)} />}
      {tab === 'profile' && <Profile user={user} />}
      {tab === 'addresses' && <Addresses user={user} />}
    </div>
  );
}

function Profile({ user }) {
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' }), [msg, setMsg] = useState(null);
  return (
    <form className="panel fgrid" onSubmit={e => { e.preventDefault(); try { updateProfile(user.id, form); setMsg(['ok', 'Profile saved.']); } catch (err) { setMsg(['err', err.message]); } }}>
      <label>Name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="07X XXX XXXX" /></label>
      <label>Email<input value={user.email} disabled /></label>
      <label>Member since<input value={fmtDate(user.createdAt)} disabled /></label>
      {msg && <p className={'notice span2 ' + msg[0]}>{msg[1]}</p>}
      <div className="span2"><button className="btn sm">Save profile</button></div>
    </form>
  );
}

const blank = { label: 'Home', address: '', city: '', phone: '', isDefault: false };
function Addresses({ user }) {
  const [edit, setEdit] = useState(null), [error, setError] = useState('');
  const f = k => ({ value: edit[k], onChange: e => setEdit({ ...edit, [k]: e.target.value }) });
  return (
    <div className="stack">
      {user.addresses.map(a => <div key={a.id} className="panel row spread"><span><b>{a.label}</b>{a.isDefault && <span className="badge b-delivered"> Default</span>}<br /><span className="muted small">{a.address}, {a.city}{a.phone && ' · ' + a.phone}</span></span><span className="row"><button className="link" onClick={() => { setEdit(a); setError(''); }}>Edit</button><button className="link" onClick={() => removeAddress(user.id, a.id)}>Remove</button></span></div>)}
      {!user.addresses.length && <p className="muted">No saved addresses yet. They pre-fill checkout.</p>}
      {edit ? <form className="panel fgrid" onSubmit={e => { e.preventDefault(); try { saveAddress(user.id, edit); setEdit(null); } catch (err) { setError(err.message); } }}>
        <label>Label<input {...f('label')} placeholder="Home, Office…" /></label>
        <label>Phone<input {...f('phone')} /></label>
        <label className="span2">Street address<input required {...f('address')} /></label>
        <label>City<input required {...f('city')} /></label>
        <label className="check"><input type="checkbox" checked={edit.isDefault} onChange={e => setEdit({ ...edit, isDefault: e.target.checked })} /> Default address</label>
        {error && <p className="notice err span2">{error}</p>}
        <div className="row span2"><button className="btn sm">Save address</button><button type="button" className="btn sm ghost" onClick={() => setEdit(null)}>Cancel</button></div>
      </form> : <div><button className="btn sm ghost" onClick={() => setEdit(blank)}>+ Add address</button></div>}
    </div>
  );
}

const REASONS = ['Wrong size', 'Changed my mind', 'Not as pictured', 'Arrived damaged', 'Gift not needed', 'Other'];
function ReturnForm({ o, data, close }) {
  const [type, setType] = useState('refund'), [reason, setReason] = useState(''), [note, setNote] = useState(''), [error, setError] = useState('');
  const [items, setItems] = useState(() => o.lines.map(l => ({ sku: l.sku, qty: 0, toOption: '' })));
  const w = returnWindow(o, data);
  const set = (i, k, v) => setItems(items.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const submit = e => { e.preventDefault(); setError(''); try { requestReturn({ orderId: o.id, email: o.customer.email, items, reason, type, note }); close(); } catch (err) { setError(err.message); } };
  return (
    <div className="modal" onClick={close}>
      <form className="modal-card" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2>Return or exchange</h2>
        <p className="muted small">Order {o.id} · you can request this until {new Date(w.until).toLocaleDateString('en-GB')}. Pieces must be unworn and in their box.</p>
        <div className="chips">{[['refund', 'Refund'], ['exchange', 'Exchange for another size']].map(([k, l]) => <button type="button" key={k} className={'chip' + (type === k ? ' on' : '')} onClick={() => setType(k)}>{l}</button>)}</div>
        <ul className="mini-lines ret-lines">{o.lines.map((l, i) => {
          const p = data.products.find(p => p.id === l.id), others = p ? p.variants.filter(v => v.active && v.option !== l.option) : [];
          return <li key={l.sku}><img src={img(l.image)} alt="" /><span>{l.name}<small>{l.option} · bought {l.qty}</small></span>
            <select value={items[i].qty} onChange={e => set(i, 'qty', Number(e.target.value))} aria-label={'Quantity to return of ' + l.name}>{Array.from({ length: l.qty + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}</select>
            {type === 'exchange' && items[i].qty > 0 && <select value={items[i].toOption} onChange={e => set(i, 'toOption', e.target.value)} aria-label="New size"><option value="">New size…</option>{others.map(v => <option key={v.sku} value={v.option} disabled={!variantOf(p, v.option) || v.stock < items[i].qty}>{v.option}{v.stock < items[i].qty ? ' (sold out)' : ''}</option>)}</select>}
          </li>;
        })}</ul>
        <label>Reason<select required value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose…</option>{REASONS.map(r => <option key={r}>{r}</option>)}</select></label>
        <label>Anything else? (optional)<textarea rows="2" value={note} onChange={e => setNote(e.target.value)} /></label>
        {error && <p className="notice err">{error}</p>}
        <div className="row"><button className="btn">Send request</button><button type="button" className="btn ghost" onClick={close}>Cancel</button></div>
      </form>
    </div>
  );
}
