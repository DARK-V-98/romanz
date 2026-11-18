import { Link } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { money, img, setCart, priceOf, variantOf } from '../../lib/store.js';

export default function Bag() {
  const { data, bag } = useStore();
  const lines = bag.map((i, idx) => ({ ...i, idx, p: data.products.find(p => p.id === i.id) })).filter(l => l.p).map(l => ({ ...l, v: variantOf(l.p, l.option), price: priceOf(l.p, l.option) }));
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0), { shippingFee, freeShippingOver } = data.settings;
  const change = (idx, qty) => setCart(qty < 1 ? bag.filter((_, i) => i !== idx) : bag.map((l, i) => i === idx ? { ...l, qty: Math.min(10, qty) } : l));
  if (!lines.length) return <div className="page narrow center"><p className="eyebrow">Your bag</p><h1>Your bag is <em>empty.</em></h1><p className="muted">Something beautiful is waiting.</p><Link to="/shop" className="btn">Start shopping</Link></div>;
  return (
    <div className="page">
      <div className="page-head"><h1>Your <em>bag.</em></h1></div>
      <div className="two-col">
        <ul className="lines">
          {lines.map(l => (
            <li key={l.idx}>
              <img src={img(l.p.image)} alt="" />
              <div className="grow"><Link to={'/shop/' + l.p.id}><b>{l.p.name}</b></Link><p className="muted small">{l.option}{(!l.p.active || !l.v) && ' · no longer available'}{l.v && l.qty > l.v.stock && ` · only ${l.v.stock} in stock`}</p>
                <div className="qty sm"><button onClick={() => change(l.idx, l.qty - 1)} aria-label="Fewer">−</button><span>{l.qty}</span><button onClick={() => change(l.idx, l.qty + 1)} aria-label="More">+</button></div>
              </div>
              <div className="right"><b>{money(l.price * l.qty)}</b><button className="link" onClick={() => change(l.idx, 0)}>Remove</button></div>
            </li>
          ))}
        </ul>
        <aside className="summary">
          <h3>Summary</h3>
          <div className="sum-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="sum-row muted"><span>Delivery</span><span>{freeShippingOver && subtotal >= freeShippingOver ? 'Free' : `${money(0)} – ${money(shippingFee)}`}</span></div>
          {freeShippingOver > 0 && subtotal < freeShippingOver && <p className="muted small">Add {money(freeShippingOver - subtotal)} more for free delivery.</p>}
          <div className="sum-row total"><span>Estimated total</span><span>{money(subtotal)}+</span></div>
          <Link to="/checkout" className="btn block">Checkout</Link>
          <p className="muted small center">Discount codes can be added at checkout</p>
        </aside>
      </div>
    </div>
  );
}
