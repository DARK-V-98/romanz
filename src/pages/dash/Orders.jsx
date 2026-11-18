import { useState } from 'react';
import { useStore } from '../../lib/hooks.js';
import { useAuth, can } from '../../lib/auth.jsx';
import { money, img, updateOrder, STATUSES } from '../../lib/store.js';
import { Badge, fmtDate, Icon } from '../../components/ui.jsx';

export default function Orders() {
  const { data } = useStore(), { user } = useAuth();
  const [q, setQ] = useState(''), [status, setStatus] = useState('All'), [openId, setOpenId] = useState(null), [error, setError] = useState('');
  const list = data.orders.filter(o => (status === 'All' || o.status === status) && (o.id + o.customer.name + o.customer.email).toLowerCase().includes(q.toLowerCase()));
  const o = data.orders.find(o => o.id === openId);
  const refund = can(user, 'payments'); // staff can move orders along but not cancel/refund
  const act = (s, collect) => { setError(''); try { updateOrder(o.id, s, collect); } catch (e) { setError(e.message); } };
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Orders</h1><p className="muted">{data.orders.length} orders · {data.orders.filter(o => o.status === 'Processing').length} waiting to be packed</p></div></div>
      <div className="toolbar">
        <div className="chips">{['All', ...STATUSES].map(s => <button key={s} className={'chip' + (status === s ? ' on' : '')} onClick={() => setStatus(s)}>{s} <small>{s === 'All' ? data.orders.length : data.orders.filter(o => o.status === s).length}</small></button>)}</div>
        <label className="search"><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Order, name or email" aria-label="Search orders" /></label>
      </div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Method</th><th>Payment</th><th>Status</th><th className="num">Total</th></tr></thead>
        <tbody>{list.map(o => <tr key={o.id} className="clickable" onClick={() => { setOpenId(o.id); setError(''); }}><td><b>{o.id}</b></td><td>{o.customer.name}<br /><small className="muted">{o.customer.city}</small></td><td>{fmtDate(o.date)}</td><td className="caps">{o.method}</td><td className="small">{o.payment}</td><td><Badge>{o.status}</Badge></td><td className="num">{money(o.total)}</td></tr>)}</tbody>
      </table>{!list.length && <p className="empty">No orders match.</p>}</div></div>

      {o && (
        <div className="drawer-wrap" onClick={() => setOpenId(null)}>
          <aside className="drawer" onClick={e => e.stopPropagation()} role="dialog" aria-label={'Order ' + o.id}>
            <div className="card-head"><h2>{o.id}</h2><button className="icon-btn" onClick={() => setOpenId(null)} aria-label="Close"><Icon name="close" /></button></div>
            <p className="muted small">{fmtDate(o.date)} · <Badge>{o.status}</Badge></p>
            <h4>Customer</h4><p>{o.customer.name}<br /><span className="muted">{o.customer.email}<br />{o.customer.address}, {o.customer.city}</span></p>
            <h4>Items</h4>
            <ul className="mini-lines">{o.lines.map((l, i) => <li key={i}><img src={img(l.image)} alt="" /><span>{l.name}<small>{l.option} × {l.qty}</small></span><b>{money(l.price * l.qty)}</b></li>)}</ul>
            <div className="sum-row"><span>Delivery ({o.delivery})</span><span>{money(o.shipping)}</span></div>
            <div className="sum-row total"><span>Total</span><span>{money(o.total)}</span></div>
            <p className="small">Payment: <b>{o.payment}</b> via <span className="caps">{o.method}</span></p>
            {o.installments && <p className="muted small">Instalments: {o.installments.map(money).join(' · ')}</p>}
            {o.status !== 'Cancelled' && <>
              <h4>Update</h4>
              <div className="row wrap">
                {o.status === 'Processing' && <button className="btn sm" onClick={() => act('Shipped')}>Mark shipped</button>}
                {o.status === 'Shipped' && <button className="btn sm" onClick={() => act('Delivered')}>Mark delivered</button>}
                {o.method === 'cod' && o.status === 'Delivered' && o.payment === 'Due on delivery' && <button className="btn sm" onClick={() => act('Delivered', true)}>Mark cash collected</button>}
                {refund ? <button className="btn sm danger" onClick={() => confirm('Cancel ' + o.id + ' and refund (mock)?') && act('Cancelled')}>Cancel & refund</button> : <span className="muted small">Cancellations need a manager.</span>}
              </div>
            </>}
            {error && <p className="notice err">{error}</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
