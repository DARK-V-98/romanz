import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { useAuth } from '../../lib/auth.jsx';
import { money, img, quote, place, uid, installment } from '../../lib/store.js';

const METHODS = [['online', 'Card / wallet (mock gateway)', 'You’ll be sent to a simulated hosted payment page.'], ['cod', 'Cash on delivery', 'Pay the courier when your piece arrives.'], ['koko', 'Pay in 3 (Koko-style)', 'Three interest-free instalments, illustrative only.']];

export default function Checkout() {
  const { bag, data } = useStore(), { user } = useAuth(), nav = useNavigate();
  const me = user?.role === 'customer' ? user : null, home = me?.addresses?.find(a => a.isDefault) || me?.addresses?.[0];
  const [form, setForm] = useState({ name: me?.name || '', email: me?.email || '', phone: me?.phone || home?.phone || '', address: home?.address || '', city: home?.city || '', note: '' });
  const [delivery, setDelivery] = useState('standard'), [method, setMethod] = useState('online');
  const [codeInput, setCodeInput] = useState(''), [code, setCode] = useState(''), [codeError, setCodeError] = useState('');
  const [token] = useState(() => uid('chk')), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  if (!bag.length) return <div className="page narrow center"><h1>Your bag is empty.</h1><p className="muted">Looking for an order? <Link to="/track">Track it here</Link>.</p><Link to="/shop" className="btn">Shop jewellery</Link></div>;
  let q = null, quoteError = '';
  try { q = quote(bag, delivery, code); } catch (e) { if (code) { try { q = quote(bag, delivery); } catch (e2) { quoteError = e2.message; } } else quoteError = e.message; }

  const f = k => ({ value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) });
  const apply = () => { setCodeError(''); try { quote(bag, delivery, codeInput); setCode(codeInput.trim().toUpperCase()); } catch (e) { setCodeError(e.message); setCode(''); } };
  const pick = a => setForm({ ...form, address: a.address, city: a.city, phone: a.phone || form.phone });
  const submit = e => {
    e.preventDefault(); setError(''); if (!q) return setError(quoteError);
    setBusy(true);
    try {
      const o = place({ items: bag, delivery, method, customer: form, token, code: q.code || '', note: form.note, userId: me?.id });
      nav((method === 'cod' ? '/order/' : '/pay/') + o.id + '?t=' + o.trackToken, { replace: true });
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="page">
      <div className="page-head"><h1>Checkout</h1><p className="muted">Demo only: please use sample details, never real card data.{!me && <> Have an account? <Link to="/login" state={{ from: '/checkout' }}>Sign in</Link> for saved addresses.</>}</p></div>
      <form className="two-col" onSubmit={submit}>
        <div className="stack">
          <section className="panel"><h3>1 · Your details</h3>
            {me?.addresses?.length > 0 && <div className="chips addr-pick">{me.addresses.map(a => <button type="button" key={a.id} className={'chip' + (form.address === a.address ? ' on' : '')} onClick={() => pick(a)}>{a.label} · {a.city}</button>)}</div>}
            <div className="fgrid">
              <label>Full name<input required autoComplete="name" {...f('name')} /></label>
              <label>Email<input type="email" required autoComplete="email" {...f('email')} /></label>
              <label>Phone (for courier & SMS updates)<input autoComplete="tel" {...f('phone')} placeholder="07X XXX XXXX" /></label>
              <label>City<input autoComplete="address-level2" {...f('city')} /></label>
              <label className="span2">Address<input required autoComplete="street-address" {...f('address')} /></label>
              <label className="span2">Gift note (optional)<textarea rows="2" maxLength="300" {...f('note')} placeholder="Happy birthday, with love…" /></label>
            </div>
          </section>
          <section className="panel"><h3>2 · Delivery</h3>
            {[['standard', 'Island-wide delivery', '2–4 working days · tracked courier', q?.shipping ?? data.settings.shippingFee], ['collection', 'Studio collection', 'Colombo 07 · ready next day', 0]].map(([v, t, d, fee]) => (
              <label key={v} className={'radio-card' + (delivery === v ? ' on' : '')}><input type="radio" name="delivery" checked={delivery === v} onChange={() => setDelivery(v)} /><span><b>{t}</b><small>{d}</small></span><b>{fee ? money(fee) : 'Free'}</b></label>
            ))}
          </section>
          <section className="panel"><h3>3 · Payment</h3>
            {METHODS.map(([v, t, d]) => (
              <label key={v} className={'radio-card' + (method === v ? ' on' : '')}><input type="radio" name="method" checked={method === v} onChange={() => setMethod(v)} /><span><b>{t}</b><small>{d}</small></span></label>
            ))}
            {method !== 'cod' && <p className="muted small">Your pieces are held for {data.settings.reservationMinutes} minutes while you pay.</p>}
          </section>
        </div>
        <aside className="summary">
          <h3>Order summary</h3>
          {q ? <>
            <ul className="mini-lines">{q.lines.map((l, i) => <li key={i}><img src={img(l.image)} alt="" /><span>{l.name}<small>{l.option} × {l.qty}</small></span><b>{money(l.price * l.qty)}</b></li>)}</ul>
            <div className="row code-row"><input value={codeInput} onChange={e => setCodeInput(e.target.value)} placeholder="Discount code" aria-label="Discount code" /><button type="button" className="btn sm ghost" onClick={apply} disabled={!codeInput.trim()}>Apply</button></div>
            {codeError && <p className="notice err small">{codeError}</p>}
            <div className="sum-row"><span>Subtotal</span><span>{money(q.subtotal)}</span></div>
            {q.discount > 0 && <div className="sum-row up"><span>Discount · {q.code} <button type="button" className="link" onClick={() => { setCode(''); setCodeInput(''); }}>remove</button></span><span>−{money(q.discount)}</span></div>}
            <div className="sum-row"><span>Delivery</span><span>{q.shipping ? money(q.shipping) : 'Free'}</span></div>
            <div className="sum-row total"><span>Total</span><span>{money(q.total)}</span></div>
            {method === 'koko' && <p className="muted small">3 × {money(installment(q.total)[0])}</p>}
          </> : <p className="notice err">{quoteError} <Link to="/bag">Edit bag</Link></p>}
          {error && <p className="notice err" role="alert">{error}</p>}
          <button className="btn block" disabled={!q || busy}>{method === 'cod' ? 'Place order' : 'Continue to payment'}</button>
          <p className="muted small center">Try code <b>WELCOME10</b></p>
        </aside>
      </form>
    </div>
  );
}
