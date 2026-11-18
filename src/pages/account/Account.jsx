import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { useAuth } from '../../lib/auth.jsx';
import { money, img } from '../../lib/store.js';
import { Badge, fmtDate } from '../../components/ui.jsx';

const STEPS = ['Processing', 'Shipped', 'Delivered'];

export default function Account() {
  const { data } = useStore(), { user, logout } = useAuth(), [tab, setTab] = useState('orders');
  const orders = data.orders.filter(o => o.customer.email === user.email);
  const spent = orders.filter(o => o.status !== 'Cancelled').reduce((a, o) => a + o.total, 0);
  const tier = spent > 150000 ? 'Gold' : spent > 60000 ? 'Rose' : 'Ivory';
  return (
    <div className="page">
      <div className="acct-head">
        <div><p className="eyebrow">My account</p><h1>Hello, <em>{user.name.split(' ')[0]}.</em></h1></div>
        <button className="btn ghost" onClick={logout}>Sign out</button>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Orders</span><b>{orders.length}</b></div>
        <div className="kpi"><span>Total spent</span><b>{money(spent)}</b></div>
        <div className="kpi"><span>Circle tier</span><b>{tier}</b></div>
        <div className="kpi"><span>Reward points</span><b>{Math.floor(spent / 100)}</b></div>
      </div>
      <div className="chips">{[['orders', 'Orders'], ['profile', 'Profile']].map(([k, l]) => <button key={k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'orders' ? (
        orders.length ? <div className="stack">{orders.map(o => (
          <details key={o.id} className="panel order-card">
            <summary><span><b>{o.id}</b><small className="muted"> · {fmtDate(o.date)}</small></span><span className="row"><Badge>{o.status}</Badge><b>{money(o.total)}</b></span></summary>
            {o.status !== 'Cancelled' && <ol className="track">{STEPS.map((s, i) => <li key={s} className={STEPS.indexOf(o.status) >= i ? 'on' : ''}>{s}</li>)}</ol>}
            <ul className="mini-lines">{o.lines.map((l, i) => <li key={i}><img src={img(l.image)} alt="" /><span>{l.name}<small>{l.option} × {l.qty}</small></span><b>{money(l.price * l.qty)}</b></li>)}</ul>
            <p className="muted small">{o.delivery === 'standard' ? 'Delivery to ' + o.customer.city : 'Studio collection'} · {o.method.toUpperCase()} · {o.payment}</p>
            {o.installments && <p className="muted small">Instalments: {o.installments.map(money).join(' · ')}</p>}
          </details>
        ))}</div> : <div className="empty">No orders yet. <Link to="/shop">Find your first piece →</Link></div>
      ) : (
        <div className="panel fgrid">
          <label>Name<input defaultValue={user.name} disabled /></label>
          <label>Email<input defaultValue={user.email} disabled /></label>
          <label>Member since<input defaultValue="March 2024 (sample)" disabled /></label>
          <label>Ring size<input defaultValue="US 6 (sample)" disabled /></label>
          <p className="muted small span2">Profile editing is disabled in this mock.</p>
        </div>
      )}
    </div>
  );
}
