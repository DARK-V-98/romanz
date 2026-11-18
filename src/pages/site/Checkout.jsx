import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { useAuth } from '../../lib/auth.jsx';
import { money, img, quote, place, attempt, uid, installment } from '../../lib/store.js';

const METHODS = [['online', 'Card (mock gateway)', 'Simulated approval, decline or cancel.'], ['cod', 'Cash on delivery', 'Pay the courier when your piece arrives.'], ['koko', 'Pay in 3 (Koko-style)', 'Three interest-free instalments, illustrative only.']];

export default function Checkout() {
  const { bag } = useStore(), { user } = useAuth();
  const me = user?.role === 'customer' ? user : null;
  const [form, setForm] = useState({ name: me?.name || '', email: me?.email || '', phone: '', address: me ? '24 Sample Lane' : '', city: me ? 'Colombo 07' : '', note: '' });
  const [delivery, setDelivery] = useState('standard'), [method, setMethod] = useState('online');
  const [token] = useState(() => uid('chk')), [gateway, setGateway] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(null);

  if (done) return (
    <div className="page narrow center">
      <p className="eyebrow">Order confirmed</p><h1>Thank you, <em>{done.customer.name.split(' ')[0]}.</em></h1>
      <p className="muted">Order <b>{done.id}</b> · {money(done.total)} · {done.payment}</p>
      {done.installments && <p className="muted small">Instalments: {done.installments.map(money).join(' · ')}</p>}
      <div className="row center-row"><Link to="/shop" className="btn ghost">Keep shopping</Link>{me && <Link to="/account" className="btn">View my orders</Link>}</div>
      {!me && <p className="muted small">Tip: sign in as the demo customer to see order history.</p>}
    </div>
  );

  let q = null, quoteError = '';
  try { q = quote(bag, delivery); } catch (e) { quoteError = e.message; }
  if (!bag.length) return <div className="page narrow center"><h1>Your bag is empty.</h1><Link to="/shop" className="btn">Shop jewellery</Link></div>;

  const f = k => ({ value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) });
  const finish = () => { try { setDone(place({ items: bag, delivery, method, customer: form, token })); } catch (e) { setError(e.message); } setGateway(false); };
  const submit = e => { e.preventDefault(); setError(''); if (!q) return setError(quoteError); method === 'cod' ? finish() : setGateway(true); };
  const fail = outcome => { attempt(method, outcome, q.total, token); setGateway(false); setError(outcome === 'Declined (mock)' ? 'The mock gateway declined this payment. Your bag is safe, try again or choose another method.' : 'Payment cancelled. Your bag is still here.'); };

  return (
    <div className="page">
      <div className="page-head"><h1>Checkout</h1><p className="muted">Demo only: please use sample details, never real card data.</p></div>
      <form className="two-col" onSubmit={submit}>
        <div className="stack">
          <section className="panel"><h3>1 · Your details</h3>
            <div className="fgrid">
              <label>Full name<input required {...f('name')} /></label>
              <label>Email<input type="email" required {...f('email')} /></label>
              <label>Phone<input {...f('phone')} placeholder="07X XXX XXXX" /></label>
              <label>City<input {...f('city')} /></label>
              <label className="span2">Address<input required {...f('address')} /></label>
              <label className="span2">Gift note (optional)<textarea rows="2" {...f('note')} placeholder="Happy birthday, with love…" /></label>
            </div>
          </section>
          <section className="panel"><h3>2 · Delivery</h3>
            {[['standard', 'Island-wide delivery', '2–4 working days', 350], ['collection', 'Studio collection', 'Colombo 07 · ready next day', 0]].map(([v, t, d, fee]) => (
              <label key={v} className={'radio-card' + (delivery === v ? ' on' : '')}><input type="radio" name="delivery" checked={delivery === v} onChange={() => setDelivery(v)} /><span><b>{t}</b><small>{d}</small></span><b>{fee ? money(fee) : 'Free'}</b></label>
            ))}
          </section>
          <section className="panel"><h3>3 · Payment</h3>
            {METHODS.map(([v, t, d]) => (
              <label key={v} className={'radio-card' + (method === v ? ' on' : '')}><input type="radio" name="method" checked={method === v} onChange={() => setMethod(v)} /><span><b>{t}</b><small>{d}</small></span></label>
            ))}
          </section>
        </div>
        <aside className="summary">
          <h3>Order summary</h3>
          {q ? <>
            <ul className="mini-lines">{q.lines.map((l, i) => <li key={i}><img src={img(l.image)} alt="" /><span>{l.name}<small>{l.option} × {l.qty}</small></span><b>{money(l.price * l.qty)}</b></li>)}</ul>
            <div className="sum-row"><span>Subtotal</span><span>{money(q.subtotal)}</span></div>
            <div className="sum-row"><span>Delivery</span><span>{q.shipping ? money(q.shipping) : 'Free'}</span></div>
            <div className="sum-row total"><span>Total</span><span>{money(q.total)}</span></div>
            {method === 'koko' && <p className="muted small">3 × {money(installment(q.total)[0])}</p>}
          </> : <p className="notice err">{quoteError} <Link to="/bag">Edit bag</Link></p>}
          {error && <p className="notice err" role="alert">{error}</p>}
          <button className="btn block" disabled={!q}>{method === 'cod' ? 'Place order' : 'Continue to payment'}</button>
        </aside>
      </form>
      {gateway && q && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Mock payment">
          <div className="modal-card center">
            <p className="eyebrow">Mock {method === 'koko' ? 'instalment' : 'payment'} gateway</p>
            <h2>{money(q.total)}</h2>
            <p className="muted small">No card details are requested. Choose an outcome to simulate.</p>
            <div className="stack">
              <button className="btn block" onClick={finish}>Approve payment</button>
              <button className="btn ghost block" onClick={() => fail('Declined (mock)')}>Simulate decline</button>
              <button className="link" onClick={() => fail('Cancelled by customer')}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
