import { Link } from 'react-router-dom';
import { money, img, addToCart, FLOW, COLLECTION_FLOW, publicEvents } from '../lib/store.js';

const paths = {
  bag: <><path d="M4 8h16l1 14H3L4 8Z" /><path d="M8 10V6a4 4 0 0 1 8 0v4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  menu: <path d="M3 7h18M3 12h18M3 17h18" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
  box: <><path d="M3 7l9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>,
  tag: <><path d="M3 12V3h9l9 9-9 9-9-9Z" /><circle cx="8" cy="8" r="1.5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c1-3.5 3.8-5 7-5s6 1.5 7 5" /><path d="M16 4a3.5 3.5 0 0 1 0 7M22 20c-.6-2.4-2-3.8-4-4.5" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m3 6 9 7 9-7" /></>,
  shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  out: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  spark: <path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2Z" />,
  truck: <><path d="M2 6h12v10H2zM14 10h4l4 4v2h-8" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  gift: <><rect x="3" y="9" width="18" height="12" /><path d="M3 13h18M12 9v12M12 9C9 9 7 4 9.5 4S12 9 12 9Zm0 0c3 0 5-5 2.5-5S12 9 12 9Z" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></>,
  print: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="1" /><path d="M7 14h10v7H7z" /></>,
  send: <path d="M3 11 21 3l-8 18-2-8-8-2Z" />,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>
};
export const Icon = ({ name, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
);

export function ProductCard({ p }) {
  const out = p.stock <= 0, first = p.variants.find(v => v.active && v.stock > 0);
  return (
    <article className="pcard">
      <Link to={'/shop/' + p.id} className="pcard-img">
        <img src={img(p.image)} alt={p.name} loading="lazy" />
        <span className="pcard-tag">{out ? 'Sold out' : p.compareAt ? 'Sale' : p.tag}</span>
      </Link>
      <div className="pcard-body">
        <div>
          <p className="pcard-cat">{p.category}</p>
          <h3><Link to={'/shop/' + p.id}>{p.name}</Link></h3>
          <p className="pcard-price">{money(p.price)}{p.compareAt && <s className="muted"> {money(p.compareAt)}</s>}</p>
        </div>
        <button className="icon-btn" disabled={out} onClick={() => first && addToCart(p.id, first.option)} aria-label={'Add ' + p.name + ' to bag'} title={first ? 'Quick add · ' + first.option : 'Sold out'}><Icon name="bag" size={18} /></button>
      </div>
    </article>
  );
}

export const Badge = ({ children }) => <span className={'badge b-' + String(children).toLowerCase().split(/[ (]/)[0]}>{children}</span>;
export const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = d => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Progress bar plus event list for an order. `all` shows internal events too (studio view).
export function Timeline({ order, all = false }) {
  const steps = order.delivery === 'collection' ? COLLECTION_FLOW : FLOW;
  const label = s => order.delivery === 'collection' && s === 'Delivered' ? 'Collected' : s;
  const reached = Math.max(...order.events.map(e => steps.indexOf(e.status)), order.status === 'Pending payment' ? -1 : 0);
  const events = all ? order.events : publicEvents(order);
  return (
    <div className="timeline">
      {!['Cancelled', 'Returned', 'Pending payment'].includes(order.status) && <ol className="track">{steps.map((s, i) => <li key={s} className={reached >= i ? 'on' : ''}>{label(s)}</li>)}</ol>}
      <ul className="events">{events.map((e, i) => <li key={i} className={e.visible ? '' : 'internal'}><b>{e.text}</b><small>{fmtTime(e.date)}{all && ' · ' + e.by}{!e.visible && ' · internal'}</small></li>)}</ul>
    </div>
  );
}
