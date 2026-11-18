import { useState } from 'react';
import { useStore } from '../../lib/hooks.js';
import { USERS, ROLES } from '../../lib/auth.jsx';
import { money, customers, markRead, saveSettings, reset, load } from '../../lib/store.js';
import { fmtDate, Icon } from '../../components/ui.jsx';

export function Customers() {
  const { data } = useStore(), [q, setQ] = useState('');
  const list = customers(data).filter(c => (c.name + c.email + c.city).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Customers</h1><p className="muted">Built from order history · {list.length} people</p></div></div>
      <div className="toolbar"><label className="search"><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search customers" aria-label="Search customers" /></label></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Customer</th><th>City</th><th className="num">Orders</th><th className="num">Lifetime value</th><th>Last order</th></tr></thead>
        <tbody>{list.map(c => <tr key={c.email}><td><span className="cell-img"><span className="avatar">{c.name[0]}</span><span><b>{c.name}</b><br /><small className="muted">{c.email}</small></span></span></td><td>{c.city}</td><td className="num">{c.orders}</td><td className="num">{money(c.spent)}</td><td>{fmtDate(c.last)}</td></tr>)}</tbody>
      </table></div></div>
    </div>
  );
}

export function Payments() {
  const { data } = useStore(), [method, setMethod] = useState('all');
  const list = data.transactions.filter(t => method === 'all' || t.method === method);
  const by = m => data.orders.filter(o => o.method === m && o.status !== 'Cancelled').reduce((a, o) => a + o.total, 0);
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Payments</h1><p className="muted">Simulated gateway events. No real money moves.</p></div></div>
      <div className="kpis">{[['online', 'Card (mock)'], ['cod', 'Cash on delivery'], ['koko', 'Pay in 3']].map(([m, l]) => <div key={m} className="kpi"><span>{l}</span><b>{money(by(m))}</b></div>)}<div className="kpi"><span>Refunded</span><b>{data.orders.filter(o => o.payment === 'Refunded (mock)').length} orders</b></div></div>
      <div className="toolbar"><div className="chips">{['all', 'online', 'cod', 'koko'].map(m => <button key={m} className={'chip' + (method === m ? ' on' : '')} onClick={() => setMethod(m)}>{m}</button>)}</div></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Event</th><th>Date</th><th>Method</th><th>Outcome</th><th>Order</th><th className="num">Amount</th></tr></thead>
        <tbody>{list.slice(0, 150).map(t => <tr key={t.id}><td className="small">{t.id}</td><td>{fmtDate(t.date)}</td><td className="caps">{t.method}</td><td>{t.outcome}</td><td>{t.orderId || '—'}</td><td className="num">{money(t.total)}</td></tr>)}</tbody>
      </table></div></div>
    </div>
  );
}

export function Inbox() {
  const { data } = useStore(), [openId, setOpenId] = useState(data.messages[0]?.id);
  const m = data.messages.find(m => m.id === openId);
  const open = id => { setOpenId(id); markRead(id); };
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Inbox</h1><p className="muted">Messages from the contact form · {data.messages.filter(m => !m.read).length} unread</p></div></div>
      <div className="inbox card">
        <ul>{data.messages.map(x => <li key={x.id}><button className={(x.id === openId ? 'on ' : '') + (x.read ? '' : 'unread')} onClick={() => open(x.id)}><b>{x.name}</b><small>{x.topic} · {fmtDate(x.date)}</small><span className="muted small">{x.body.slice(0, 60)}…</span></button></li>)}</ul>
        {m ? <div className="msg"><h3>{m.topic}</h3><p className="muted small">{m.name} · {m.email} · {fmtDate(m.date)}</p><p>{m.body}</p><div className="row"><a className="btn sm" href={'mailto:' + m.email + '?subject=Re: ' + encodeURIComponent(m.topic)}>Reply by email</a><button className="btn sm ghost" onClick={() => markRead(m.id, false)}>Mark unread</button></div></div> : <p className="empty">No messages.</p>}
      </div>
    </div>
  );
}

export function Team() {
  const perms = ['overview', 'orders', 'products', 'customers', 'payments', 'inbox', 'team', 'settings'];
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Team & roles</h1><p className="muted">Mock accounts and what each role can open.</p></div></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Member</th><th>Role</th><th>Login</th></tr></thead>
        <tbody>{USERS.map(u => <tr key={u.id}><td><span className="cell-img"><span className={'avatar r-' + u.role}>{u.name[0]}</span><span><b>{u.name}</b><br /><small className="muted">{u.title}</small></span></span></td><td>{ROLES[u.role].label}</td><td className="small">{u.email} / {u.password}</td></tr>)}</tbody>
      </table></div></div>
      <div className="card"><h3>Permission matrix</h3><div className="table-wrap"><table>
        <thead><tr><th>Area</th>{Object.values(ROLES).map(r => <th key={r.label} className="center">{r.label}</th>)}</tr></thead>
        <tbody>{perms.map(p => <tr key={p}><td className="caps">{p}</td>{Object.values(ROLES).map(r => <td key={r.label} className="center">{r.can.includes(p) ? '✓' : '—'}</td>)}</tr>)}</tbody>
      </table></div><p className="muted small">Customers only see their own account and order history. Staff can ship orders but not cancel or refund.</p></div>
    </div>
  );
}

export function Settings() {
  const { data } = useStore(), [form, setForm] = useState(data.settings), [msg, setMsg] = useState('');
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Settings</h1><p className="muted">Store-wide options for this demo.</p></div></div>
      <form className="card fgrid" onSubmit={e => { e.preventDefault(); saveSettings(form); setMsg('Saved. The announcement bar is updated on the store.'); }}>
        <label className="span2">Announcement bar<input maxLength="120" value={form.announcement} onChange={e => setForm({ ...form, announcement: e.target.value })} /></label>
        <label className="span2">Support email<input type="email" value={form.supportEmail} onChange={e => setForm({ ...form, supportEmail: e.target.value })} /></label>
        {msg && <p className="notice ok span2">{msg}</p>}
        <div><button className="btn sm">Save settings</button></div>
      </form>
      <div className="card danger-zone">
        <h3>Reset demo data</h3>
        <p className="muted">Restores the sample catalogue, orders, payments and messages, and empties the bag in this browser.</p>
        <button className="btn sm danger" onClick={() => { if (confirm('Reset all demo data in this browser?')) { reset(); setForm(load().settings); setMsg(''); } }}>Reset demo data</button>
      </div>
    </div>
  );
}
