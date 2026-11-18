import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { useAuth, ROLES, actorOf } from '../../lib/auth.jsx';
import { money, customers, markRead, replyMessage, saveSettings, saveDiscount, inviteMember, setMember, expireUnpaid, reset, load, isRevenue } from '../../lib/store.js';
import { fmtDate, fmtTime, Icon } from '../../components/ui.jsx';

export function Customers() {
  const { data } = useStore(), [q, setQ] = useState(''), [params, setParams] = useSearchParams(), open = params.get('open'), setOpen = e => setParams(e ? { open: e } : {}, { replace: true });
  const list = customers(data).filter(c => (c.name + c.email + c.city + (c.phone || '')).toLowerCase().includes(q.toLowerCase()));
  const c = customers(data).find(c => c.email === open), orders = c ? data.orders.filter(o => o.customer.email === c.email) : [];
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Customers</h1><p className="muted">{list.length} people · {list.filter(c => c.account).length} with accounts, the rest checked out as guests</p></div></div>
      <div className="toolbar"><label className="search"><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, phone" aria-label="Search customers" /></label></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Customer</th><th>City</th><th>Type</th><th className="num">Orders</th><th className="num">Lifetime value</th><th>Last order</th></tr></thead>
        <tbody>{list.map(c => <tr key={c.email} className="clickable" onClick={() => setOpen(c.email)}><td><span className="cell-img"><span className="avatar">{c.name[0]}</span><span><b>{c.name}</b><br /><small className="muted">{c.email}</small></span></span></td><td>{c.city}</td><td className="small">{c.account ? 'Account' : 'Guest'}</td><td className="num">{c.orders}</td><td className="num">{money(c.spent)}</td><td>{c.last ? fmtDate(c.last) : '—'}</td></tr>)}</tbody>
      </table></div></div>
      {c && <div className="drawer-wrap" onClick={() => setOpen(null)}><aside className="drawer" onClick={e => e.stopPropagation()}>
        <div className="card-head"><h2>{c.name}</h2><button className="icon-btn" onClick={() => setOpen(null)} aria-label="Close"><Icon name="close" /></button></div>
        <p className="muted">{c.email}{c.phone && ' · ' + c.phone}<br />{c.city} · {c.account ? 'Has an account' : 'Guest checkout'}</p>
        <div className="kpis two"><div className="kpi"><span>Orders</span><b>{c.orders}</b></div><div className="kpi"><span>Lifetime value</span><b>{money(c.spent)}</b></div></div>
        <h4>Orders</h4>
        <ul className="events">{orders.map(o => <li key={o.id}><b>{o.id} · {money(o.total)}</b><small>{fmtDate(o.date)} · {o.status} · {o.payment}</small></li>)}</ul>
        <a className="btn sm ghost" href={'mailto:' + c.email}>Email customer</a>
      </aside></div>}
    </div>
  );
}

export function Payments() {
  const { data } = useStore(), [method, setMethod] = useState('all'), [src, setSrc] = useState('all');
  const list = data.transactions.filter(t => (method === 'all' || t.method === method) && (src === 'all' || t.source === src));
  const by = m => data.orders.filter(o => o.method === m && isRevenue(o)).reduce((a, o) => a + o.total, 0);
  const rejected = data.transactions.filter(t => t.verified === false).length;
  const cod = data.orders.filter(o => o.payment === 'Due on delivery' && o.status !== 'Cancelled').reduce((a, o) => a + o.total, 0);
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Payments</h1><p className="muted">Gateway notifications, cash collections and refunds. Simulated: no real money moves.</p></div></div>
      <div className="kpis">{[['online', 'Card (mock)'], ['koko', 'Pay in 3']].map(([m, l]) => <div key={m} className="kpi"><span>{l}</span><b>{money(by(m))}</b></div>)}<div className="kpi"><span>COD still to collect</span><b>{money(cod)}</b></div><div className="kpi"><span>Rejected webhooks</span><b className={rejected ? 'down' : ''}>{rejected}</b></div></div>
      <div className="toolbar">
        <div className="chips">{['all', 'online', 'cod', 'koko'].map(m => <button key={m} className={'chip' + (method === m ? ' on' : '')} onClick={() => setMethod(m)}>{m}</button>)}</div>
        <div className="chips">{[['all', 'All sources'], ['webhook', 'Gateway webhook'], ['checkout', 'Checkout'], ['studio', 'Studio action']].map(([k, l]) => <button key={k} className={'chip' + (src === k ? ' on' : '')} onClick={() => setSrc(k)}>{l}</button>)}</div>
      </div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Event</th><th>Date</th><th>Source</th><th>Method</th><th>Outcome</th><th>Order</th><th className="num">Amount</th></tr></thead>
        <tbody>{list.slice(0, 200).map(t => <tr key={t.id}><td className="small">{t.id}</td><td className="small">{fmtTime(t.date)}</td><td className="small">{t.source === 'webhook' ? (t.verified === false ? <span className="down">✕ webhook</span> : '✓ webhook') : t.source || '—'}</td><td className="caps">{t.method}</td><td className={t.outcome.startsWith('Rejected') ? 'down' : ''}>{t.outcome}</td><td>{t.orderId || '—'}</td><td className="num">{money(t.total)}</td></tr>)}</tbody>
      </table></div></div>
      <p className="muted small">✓ means the notification’s signature and amount matched the order. ✕ notifications are logged and ignored, so the order is never marked paid by them.</p>
    </div>
  );
}

export function Inbox() {
  const { data } = useStore(), { user } = useAuth(), [openId, setOpenId] = useState(data.messages[0]?.id), [reply, setReply] = useState(''), [error, setError] = useState('');
  const m = data.messages.find(m => m.id === openId);
  const open = id => { setOpenId(id); markRead(id); setReply(''); setError(''); };
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Inbox</h1><p className="muted">Messages from the contact form · {data.messages.filter(m => !m.read).length} unread</p></div></div>
      <div className="inbox card">
        <ul>{data.messages.map(x => <li key={x.id}><button className={(x.id === openId ? 'on ' : '') + (x.read ? '' : 'unread')} onClick={() => open(x.id)}><b>{x.name}</b><small>{x.topic} · {fmtDate(x.date)}{x.replies?.length ? ' · replied' : ''}</small><span className="muted small">{x.body.slice(0, 60)}…</span></button></li>)}</ul>
        {m ? <div className="msg">
          <h3>{m.topic}</h3><p className="muted small">{m.name} · {m.email} · {fmtTime(m.date)}{m.orderId && <> · order <b>{m.orderId}</b></>}</p><p>{m.body}</p>
          {m.replies?.map((r, i) => <div key={i} className="reply"><small className="muted">{r.by} replied · {fmtTime(r.date)}</small><p>{r.body}</p></div>)}
          <form onSubmit={e => { e.preventDefault(); try { replyMessage(m.id, reply, actorOf(user)); setReply(''); } catch (err) { setError(err.message); } }}>
            <label>Reply<textarea rows="3" value={reply} onChange={e => setReply(e.target.value)} placeholder={'Hi ' + m.name.split(' ')[0] + ','} /></label>
            {error && <p className="notice err">{error}</p>}
            <div className="row"><button className="btn sm"><Icon name="send" size={14} /> Send reply (mock email)</button><button type="button" className="btn sm ghost" onClick={() => markRead(m.id, false)}>Mark unread</button></div>
          </form>
        </div> : <p className="empty">No messages.</p>}
      </div>
    </div>
  );
}

export function Outbox() {
  const { data } = useStore(), [ch, setCh] = useState('all'), [open, setOpen] = useState(null);
  const list = data.outbox.filter(m => ch === 'all' || m.channel === ch);
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Outbox</h1><p className="muted">Every email and SMS the store would have sent: order confirmations, shipping updates, invites, password resets. Nothing actually leaves the browser.</p></div></div>
      <div className="toolbar"><div className="chips">{[['all', 'All'], ['email', 'Email'], ['sms', 'SMS']].map(([k, l]) => <button key={k} className={'chip' + (ch === k ? ' on' : '')} onClick={() => setCh(k)}>{l} <small>{k === 'all' ? data.outbox.length : data.outbox.filter(m => m.channel === k).length}</small></button>)}</div></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Sent</th><th>Channel</th><th>To</th><th>Subject</th><th>Order</th></tr></thead>
        <tbody>{list.map(m => <Fragment key={m.id}>
          <tr className="clickable" onClick={() => setOpen(open === m.id ? null : m.id)}><td className="small">{fmtTime(m.date)}</td><td className="caps">{m.channel}</td><td>{m.to}</td><td><b>{m.subject}</b></td><td>{m.orderId || '—'}</td></tr>
          {open === m.id && <tr><td colSpan="5"><div className="mail-body">{m.body}</div></td></tr>}
        </Fragment>)}</tbody>
      </table>{!list.length && <p className="empty">Nothing sent yet. Place an order, ship one, or invite a team member.</p>}</div></div>
    </div>
  );
}

export function Discounts() {
  const { data } = useStore(), { user } = useAuth(), [edit, setEdit] = useState(null), [error, setError] = useState('');
  const f = k => ({ value: edit[k] ?? '', onChange: e => setEdit({ ...edit, [k]: e.target.value }) });
  const save = e => { e.preventDefault(); try { saveDiscount({ ...edit, value: Number(edit.value), min: Number(edit.min), maxUses: Number(edit.maxUses) }, actorOf(user)); setEdit(null); } catch (err) { setError(err.message); } };
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Discount codes</h1><p className="muted">Customers enter these at checkout. Totals are always recalculated by the store, never trusted from the browser.</p></div><button className="btn sm" onClick={() => { setEdit({ code: '', type: 'percent', value: 10, min: 0, maxUses: 0, active: true, endsAt: '', isNew: true }); setError(''); }}>+ New code</button></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Code</th><th>Discount</th><th>Min. spend</th><th>Used</th><th>Ends</th><th>Status</th><th></th></tr></thead>
        <tbody>{data.discounts.map(d => <tr key={d.code}><td><b>{d.code}</b></td><td>{d.type === 'percent' ? d.value + '%' : money(d.value)}</td><td>{d.min ? money(d.min) : '—'}</td><td>{d.uses}{d.maxUses ? ' / ' + d.maxUses : ''}</td><td>{d.endsAt ? fmtDate(d.endsAt) : '—'}</td><td><span className={'badge ' + (d.active ? 'b-delivered' : 'b-cancelled')}>{d.active ? 'Active' : 'Off'}</span></td><td><button className="link" onClick={() => { setEdit({ ...d, endsAt: d.endsAt || '' }); setError(''); }}>Edit</button></td></tr>)}</tbody>
      </table></div></div>
      {edit && <div className="modal" onClick={() => setEdit(null)}><form className="modal-card" onClick={e => e.stopPropagation()} onSubmit={save}>
        <h2>{edit.isNew ? 'New code' : edit.code}</h2>
        <div className="fgrid">
          <label>Code<input required {...f('code')} disabled={!edit.isNew} onChange={e => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></label>
          <label>Type<select {...f('type')}><option value="percent">Percent off</option><option value="fixed">Fixed LKR off</option></select></label>
          <label>{edit.type === 'percent' ? 'Percent' : 'Amount (LKR)'}<input type="number" min="1" required {...f('value')} /></label>
          <label>Minimum subtotal (LKR)<input type="number" min="0" {...f('min')} /></label>
          <label>Max uses (0 = unlimited)<input type="number" min="0" {...f('maxUses')} /></label>
          <label>Ends on (optional)<input type="date" {...f('endsAt')} /></label>
          <label className="check"><input type="checkbox" checked={edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })} /> Active</label>
        </div>
        {error && <p className="notice err">{error}</p>}
        <div className="row"><button className="btn">Save</button><button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button></div>
      </form></div>}
    </div>
  );
}

export function Team() {
  const { data } = useStore(), { user } = useAuth(), actor = actorOf(user);
  const [invite, setInvite] = useState(null), [msg, setMsg] = useState(null);
  const perms = ['overview', 'orders', 'products', 'customers', 'payments', 'inbox', 'team', 'settings'];
  const team = data.users.filter(u => u.role !== 'customer');
  const run = fn => { setMsg(null); try { fn(); } catch (e) { setMsg(['err', e.message]); } };
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Team & roles</h1><p className="muted">Invite staff, change what they can open, or switch accounts off.</p></div><button className="btn sm" onClick={() => setInvite({ name: '', email: '', role: 'staff', title: '' })}>+ Invite member</button></div>
      {msg && <p className={'notice ' + msg[0]}>{msg[1]}</p>}
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Demo login</th></tr></thead>
        <tbody>{team.map(u => <tr key={u.id}>
          <td><span className="cell-img"><span className={'avatar r-' + u.role}>{u.name[0]}</span><span><b>{u.name}</b>{u.id === user.id && <small className="muted"> · you</small>}<br /><small className="muted">{u.title}</small></span></span></td>
          <td><select value={u.role} disabled={u.id === user.id} onChange={e => run(() => setMember(u.id, { role: e.target.value }, actor))} aria-label={'Role for ' + u.name}>{['staff', 'manager', 'admin'].map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}</select></td>
          <td>{u.id === user.id ? <span className="badge b-delivered">Active</span> : <button className={'badge ' + (u.active ? 'b-delivered' : 'b-cancelled')} onClick={() => run(() => setMember(u.id, { active: !u.active }, actor))} title="Click to toggle">{u.active ? 'Active' : 'Deactivated'}</button>}</td>
          <td className="small">{u.email} / {u.password}</td>
        </tr>)}</tbody>
      </table></div></div>
      <div className="card"><h3>Permission matrix</h3><div className="table-wrap"><table>
        <thead><tr><th>Area</th>{Object.values(ROLES).map(r => <th key={r.label} className="center">{r.label}</th>)}</tr></thead>
        <tbody>{perms.map(p => <tr key={p}><td className="caps">{p}</td>{Object.values(ROLES).map(r => <td key={r.label} className="center">{r.can.includes(p) ? '✓' : '—'}</td>)}</tr>)}</tbody>
      </table></div><p className="muted small">Staff can pack, ship and deliver orders but not cancel, refund or edit products. Managers can do everything except team and settings. Customers only see their own account.</p></div>
      <div className="card"><h3>Audit log</h3><div className="table-wrap"><table>
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
        <tbody>{data.audit.slice(0, 100).map(a => <tr key={a.id}><td className="small">{fmtTime(a.date)}</td><td>{a.by}<br /><small className="muted">{a.role}</small></td><td>{a.action}</td><td className="small">{a.detail}</td></tr>)}</tbody>
      </table>{!data.audit.length && <p className="empty">No changes recorded yet.</p>}</div></div>
      {invite && <div className="modal" onClick={() => setInvite(null)}><form className="modal-card" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); run(() => { const pw = inviteMember(invite, actor); setMsg(['ok', `Invite sent to ${invite.email}. Temporary password: ${pw} (also in the Outbox).`]); setInvite(null); }); }}>
        <h2>Invite a team member</h2>
        <div className="fgrid">
          <label>Name<input required value={invite.name} onChange={e => setInvite({ ...invite, name: e.target.value })} /></label>
          <label>Email<input type="email" required value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} /></label>
          <label>Role<select value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value })}>{['staff', 'manager', 'admin'].map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}</select></label>
          <label>Job title<input value={invite.title} onChange={e => setInvite({ ...invite, title: e.target.value })} placeholder="Packing & dispatch" /></label>
        </div>
        {msg?.[0] === 'err' && <p className="notice err">{msg[1]}</p>}
        <div className="row"><button className="btn">Send invite</button><button type="button" className="btn ghost" onClick={() => setInvite(null)}>Cancel</button></div>
      </form></div>}
    </div>
  );
}

export function Settings() {
  const { data } = useStore(), { user } = useAuth(), [form, setForm] = useState(data.settings), [msg, setMsg] = useState(null);
  const f = (k, num) => ({ value: form[k], onChange: e => setForm({ ...form, [k]: num ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }) });
  const setC = (i, k, v) => setForm({ ...form, couriers: form.couriers.map((c, j) => j === i ? { ...c, [k]: v } : c) });
  const save = e => { e.preventDefault(); try { saveSettings({ ...form, shippingFee: Number(form.shippingFee), freeShippingOver: Number(form.freeShippingOver), reservationMinutes: Number(form.reservationMinutes), returnDays: Number(form.returnDays) }, actorOf(user)); setMsg(['ok', 'Saved. The store uses the new values straight away.']); } catch (err) { setMsg(['err', err.message]); } };
  const pending = data.orders.filter(o => o.status === 'Pending payment').length;
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Settings</h1><p className="muted">Store-wide options.</p></div></div>
      <form className="card fgrid" onSubmit={save}>
        <h3 className="span2">Store</h3>
        <label className="span2">Announcement bar<input maxLength="120" {...f('announcement')} /></label>
        <label>Support email<input type="email" {...f('supportEmail')} /></label>
        <label>Support phone<input {...f('supportPhone')} /></label>
        <h3 className="span2">Delivery & checkout</h3>
        <label>Delivery fee (LKR)<input type="number" min="0" {...f('shippingFee', true)} /></label>
        <label>Free delivery over (LKR, 0 = off)<input type="number" min="0" {...f('freeShippingOver', true)} /></label>
        <label>Payment window (minutes)<input type="number" min="1" max="1440" {...f('reservationMinutes', true)} /></label>
        <label>Return window (days after delivery)<input type="number" min="0" max="90" {...f('returnDays', true)} /></label>
        <label className="check span2"><input type="checkbox" checked={!!form.autoCourier} onChange={e => setForm({ ...form, autoCourier: e.target.checked })} /> Courier simulator: move new shipped orders along automatically (hub → out for delivery → delivered, about every 15 s)</label>
        <p className="muted small">Unpaid card / Koko orders hold their stock for this long, then cancel automatically.</p>
        <h3 className="span2">Couriers</h3>
        <div className="span2 stack">
          {form.couriers.map((c, i) => <div key={i} className="row"><input value={c.name} onChange={e => setC(i, 'name', e.target.value)} placeholder="Courier name" aria-label="Courier name" /><input value={c.url} onChange={e => setC(i, 'url', e.target.value)} placeholder="Tracking URL with {n} for the number" aria-label="Tracking URL template" /><button type="button" className="link" onClick={() => setForm({ ...form, couriers: form.couriers.filter((_, j) => j !== i) })}>Remove</button></div>)}
          <div><button type="button" className="btn sm ghost" onClick={() => setForm({ ...form, couriers: [...form.couriers, { name: '', url: '' }] })}>+ Add courier</button></div>
          <p className="muted small">The tracking link the customer sees is built from the template, e.g. https://courier.example/track/{'{n}'}. The sample URLs are placeholders. Replace them with each courier’s real tracking page.</p>
        </div>
        {msg && <p className={'notice span2 ' + msg[0]}>{msg[1]}</p>}
        <div><button className="btn sm">Save settings</button></div>
      </form>
      <div className="card">
        <h3>Scheduled jobs</h3>
        <p className="muted">The expiry job runs every 30 seconds while the site is open (in production: a cron job every 10 minutes). {pending} order(s) are waiting for payment right now.</p>
        <button className="btn sm ghost" onClick={() => { const n = expireUnpaid(); setMsg(['ok', n ? `${n} expired order(s) cancelled and restocked.` : 'Nothing to expire.']); }}>Run expiry job now</button>
      </div>
      <div className="card danger-zone">
        <h3>Reset demo data</h3>
        <p className="muted">Restores the sample catalogue, orders, payments, team and messages, deletes uploaded photos, and empties the bag in this browser.</p>
        <button className="btn sm danger" onClick={() => { if (confirm('Reset all demo data in this browser?')) { reset(); setForm(load().settings); setMsg(null); } }}>Reset demo data</button>
      </div>
    </div>
  );
}
