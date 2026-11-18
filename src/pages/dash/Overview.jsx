import { Link } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { useAuth, can } from '../../lib/auth.jsx';
import { money, img, CATEGORIES } from '../../lib/store.js';
import { Badge, fmtDate } from '../../components/ui.jsx';

const DAY = 86400000;

export default function Overview() {
  const { data } = useStore(), { user } = useAuth();
  const now = Date.now(), live = data.orders.filter(o => o.status !== 'Cancelled');
  const inRange = (o, from, to) => { const t = now - new Date(o.date).getTime(); return t >= from * DAY && t < to * DAY; };
  const sum = list => list.reduce((a, o) => a + o.total, 0);
  const cur = live.filter(o => inRange(o, 0, 30)), prev = live.filter(o => inRange(o, 30, 60));
  const delta = (a, b) => b ? Math.round((a - b) / b * 100) : 0;
  const weeks = Array.from({ length: 12 }, (_, i) => { const w = 11 - i; return { label: w ? w + 'w' : 'now', total: sum(live.filter(o => inRange(o, w * 7, w * 7 + 7))) }; });
  const max = Math.max(...weeks.map(w => w.total), 1);
  const byCat = CATEGORIES.map(c => ({ c, total: live.reduce((a, o) => a + o.lines.filter(l => data.products.find(p => p.id === l.id)?.category === c).reduce((x, l) => x + l.price * l.qty, 0), 0) }));
  const catMax = Math.max(...byCat.map(b => b.total), 1);
  const low = data.products.filter(p => p.stock < 5).sort((a, b) => a.stock - b.stock);
  const kpis = [['Revenue · 30d', money(sum(cur)), delta(sum(cur), sum(prev))], ['Orders · 30d', cur.length, delta(cur.length, prev.length)], ['Avg. order', money(cur.length ? Math.round(sum(cur) / cur.length) : 0), null], ['To fulfil', data.orders.filter(o => o.status === 'Processing').length, null]];
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Good day, {user.name.split(' ')[0]}</h1><p className="muted">Here’s how the studio is doing.</p></div>{can(user, 'products') && <Link to="/dashboard/products" className="btn sm">+ New product</Link>}</div>
      <div className="kpis">{kpis.map(([l, v, d]) => <div key={l} className="kpi"><span>{l}</span><b>{v}</b>{d !== null && <small className={d >= 0 ? 'up' : 'down'}>{d >= 0 ? '▲' : '▼'} {Math.abs(d)}% vs prior 30d</small>}</div>)}</div>
      <div className="dash-grid">
        <section className="card wide">
          <h3>Revenue, last 12 weeks</h3>
          <div className="bars" role="img" aria-label="Weekly revenue bar chart">
            {weeks.map((w, i) => <div key={i} className="bar-col" title={money(w.total)}><div className="bar" style={{ height: (w.total / max * 100) + '%' }} /><span>{w.label}</span></div>)}
          </div>
        </section>
        <section className="card">
          <h3>Sales by category</h3>
          {byCat.map(b => <div key={b.c} className="hbar"><span>{b.c}</span><div><i style={{ width: (b.total / catMax * 100) + '%' }} /></div><b>{money(b.total)}</b></div>)}
        </section>
        <section className="card wide">
          <div className="card-head"><h3>Recent orders</h3><Link to="/dashboard/orders" className="small">View all →</Link></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th className="num">Total</th></tr></thead>
            <tbody>{data.orders.slice(0, 6).map(o => <tr key={o.id}><td><b>{o.id}</b></td><td>{o.customer.name}</td><td>{fmtDate(o.date)}</td><td><Badge>{o.status}</Badge></td><td className="num">{money(o.total)}</td></tr>)}</tbody>
          </table></div>
        </section>
        <section className="card">
          <h3>Low stock</h3>
          {low.length ? <ul className="mini-lines">{low.map(p => <li key={p.id}><img src={img(p.image)} alt="" /><span>{p.name}<small>{p.category}</small></span><b className={p.stock ? 'warn' : 'down'}>{p.stock ? p.stock + ' left' : 'Out'}</b></li>)}</ul> : <p className="muted">All pieces are well stocked.</p>}
        </section>
      </div>
    </div>
  );
}
