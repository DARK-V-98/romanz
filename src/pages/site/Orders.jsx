import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { money, img, payOrder, gatewayParams, findOrder, trackLink } from '../../lib/store.js';
import { Badge, Timeline, fmtDate } from '../../components/ui.jsx';

const useTokenOrder = () => {
  const { id } = useParams(), [params] = useSearchParams(), { data } = useStore();
  const o = data.orders.find(o => o.id === id);
  return o && o.trackToken === params.get('t') ? o : null;
};
const NotFound = () => <div className="page narrow center"><h1>Order not found</h1><p className="muted">The link may be incomplete. Look the order up with its number and email instead.</p><Link to="/track" className="btn">Track an order</Link></div>;

function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!until) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [until]);
  if (!until) return null;
  const ms = Math.max(0, new Date(until).getTime() - now);
  return Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0');
}

/* Simulated hosted payment page. In production the customer would be on the gateway's own site. */
export function Pay() {
  const o = useTokenOrder(), nav = useNavigate(), [msg, setMsg] = useState(null), left = useCountdown(o?.expiresAt);
  if (!o) return <NotFound />;
  if (o.status !== 'Pending payment') return <div className="page narrow center"><h1>Nothing to pay</h1><p className="muted">Order {o.id} is {o.status.toLowerCase()} · {o.payment}.</p><Link to={trackLink(o)} className="btn">View order</Link></div>;
  const params = gatewayParams(o);
  const act = (outcome, forge) => {
    setMsg(null);
    try {
      const r = payOrder(o.id, outcome, forge);
      if (r.status === 'Confirmed') nav('/order/' + o.id + '?t=' + o.trackToken, { replace: true });
      else setMsg(['err', outcome === 'declined' ? 'The card was declined (simulated). Your pieces are still held, so try again or choose another way to pay.' : 'Payment cancelled. Your pieces are held until the timer runs out.']);
    } catch (e) { setMsg(['err', e.message + ' The order was not marked paid.']); }
  };
  return (
    <div className="page narrow">
      <div className="gateway panel">
        <div className="gw-head"><span className="eyebrow">Mock hosted payment page</span><span className="muted small">Sandbox · no real card is charged</span></div>
        <h2>{money(o.total)}</h2>
        <p className="muted">ROMANZ Jewellery · order {o.id}{o.method === 'koko' && <> · 3 × {money(o.installments[0])}</>}</p>
        <p className="small">Pieces held for <b>{left}</b></p>
        <ul className="mini-lines">{o.lines.map((l, i) => <li key={i}><img src={img(l.image)} alt="" /><span>{l.name}<small>{l.option} × {l.qty}</small></span><b>{money(l.price * l.qty)}</b></li>)}</ul>
        {o.discount > 0 && <div className="sum-row"><span>Discount · {o.code}</span><span>−{money(o.discount)}</span></div>}
        <div className="sum-row"><span>Delivery</span><span>{o.shipping ? money(o.shipping) : 'Free'}</span></div>
        <div className="stack">
          <button className="btn block" onClick={() => act('approved')}>Approve payment</button>
          <button className="btn ghost block" onClick={() => act('declined')}>Simulate decline</button>
          <button className="link" onClick={() => act('cancelled')}>Cancel and return to the store</button>
        </div>
        {msg && <p className={'notice ' + msg[0]} role="alert">{msg[1]}</p>}
        <details className="dev">
          <summary>How this works (developer view)</summary>
          <p className="muted small">The store posts these fields to the gateway. When the customer pays, the gateway calls our server with a signed notification, and only that call marks the order paid. The page the customer comes back to never does.</p>
          <pre>{JSON.stringify(params, null, 2)}</pre>
          <button className="btn sm danger" onClick={() => act('approved', true)}>Send a forged “paid” webhook</button>
          <p className="muted small">It is rejected because the signature does not match. Check Studio → Payments.</p>
        </details>
      </div>
    </div>
  );
}

function OrderDetail({ o }) {
  return <>
    <Timeline order={o} />
    {o.shipment && <p className="small">Courier: <b>{o.shipment.courier}</b>{o.shipment.tracking && <> · {o.shipment.tracking}</>}{o.shipment.url && <> · <a className="link" href={o.shipment.url} target="_blank" rel="noreferrer">Track with courier ↗</a></>}</p>}
    <ul className="mini-lines">{o.lines.map((l, i) => <li key={i}><img src={img(l.image)} alt="" /><span>{l.name}<small>{l.option} × {l.qty}</small></span><b>{money(l.price * l.qty)}</b></li>)}</ul>
    {o.discount > 0 && <div className="sum-row"><span>Discount · {o.code}</span><span>−{money(o.discount)}</span></div>}
    <div className="sum-row"><span>Delivery</span><span>{o.shipping ? money(o.shipping) : 'Free'}</span></div>
    <div className="sum-row total"><span>Total</span><span>{money(o.total)}</span></div>
    <p className="muted small">{o.delivery === 'standard' ? 'Delivery to ' + o.customer.address + ', ' + o.customer.city : 'Studio collection · 42 Flower Road, Colombo 07'} · <span className="caps">{o.method}</span> · {o.payment}</p>
    {o.installments && <p className="muted small">Instalments: {o.installments.map(money).join(' · ')}</p>}
    {o.note && <p className="muted small">Gift note: “{o.note}”</p>}
  </>;
}

export function OrderStatus() {
  const o = useTokenOrder(), { data } = useStore();
  if (!o) return <NotFound />;
  const pending = o.status === 'Pending payment', first = o.customer.name.split(' ')[0];
  const hasAccount = data.users.some(u => u.email === o.customer.email);
  return (
    <div className="page narrow">
      <div className="page-head center">
        <p className="eyebrow">{pending ? 'Waiting for payment' : o.status === 'Cancelled' ? 'Order cancelled' : 'Order confirmed'}</p>
        <h1>{pending ? <>Almost there, <em>{first}.</em></> : o.status === 'Cancelled' ? <>Order <em>{o.id}</em></> : <>Thank you, <em>{first}.</em></>}</h1>
        <p className="muted">Order <b>{o.id}</b> · {fmtDate(o.date)} · <Badge>{o.status}</Badge></p>
        {pending && <><p className="muted">We haven’t received the payment confirmation yet.</p><Link to={'/pay/' + o.id + '?t=' + o.trackToken} className="btn">Complete payment</Link></>}
        {!pending && o.status !== 'Cancelled' && <p className="muted">A confirmation has been sent to {o.customer.email} (see the demo outbox in the studio).</p>}
      </div>
      <section className="panel"><OrderDetail o={o} /></section>
      <div className="row center-row"><Link to="/shop" className="btn ghost">Keep shopping</Link>{hasAccount ? <Link to="/account" className="btn">My orders</Link> : <Link to="/login?mode=register" state={{ email: o.customer.email, name: o.customer.name }} className="btn">Create an account</Link>}</div>
      <p className="muted small center">Bookmark this page to follow your order: it’s your private tracking link.</p>
    </div>
  );
}

export function Track() {
  const tokenOrder = useTokenOrder(), { id } = useParams(), [form, setForm] = useState({ id: id || '', email: '' }), [found, setFound] = useState(null), [error, setError] = useState('');
  const { data } = useStore();
  const live = found ? data.orders.find(o => o.id === found) : tokenOrder;
  const submit = e => { e.preventDefault(); setError(''); try { setFound(findOrder(form.id, form.email).id); } catch (err) { setError(err.message); setFound(null); } };
  return (
    <div className="page narrow">
      <div className="page-head center"><p className="eyebrow">Order tracking</p><h1>Where’s my <em>order?</em></h1></div>
      {!live && <form className="panel fgrid" onSubmit={submit}>
        <label>Order number<input required value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} placeholder="RZ-10544" /></label>
        <label>Email used at checkout<input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        {error && <p className="notice err span2" role="alert">{error}</p>}
        <div className="span2"><button className="btn">Track order</button></div>
        <p className="muted small span2">Demo: sign in as the customer to see their orders, or try <b>RZ-10480</b> with <b>customer@romanz.lk</b>.</p>
      </form>}
      {live && <section className="panel">
        <div className="card-head"><h3>{live.id}</h3><Badge>{live.status}</Badge></div>
        <OrderDetail o={live} />
        <div className="row"><Link to="/contact" state={{ orderId: live.id }} className="btn sm ghost">Ask about this order</Link>{found && <button className="link" onClick={() => setFound(null)}>Track another</button>}</div>
      </section>}
    </div>
  );
}
