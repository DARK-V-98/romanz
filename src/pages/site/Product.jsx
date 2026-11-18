import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { money, img, addToCart, installment } from '../../lib/store.js';
import { ProductCard } from '../../components/ui.jsx';

export default function Product() { const { id } = useParams(); return <ProductView key={id} id={id} />; }

function ProductView({ id }) {
  const { data, bag } = useStore();
  const p = data.products.find(p => p.id === id && p.active);
  const [option, setOption] = useState(p?.options[0]), [qty, setQty] = useState(1), [added, setAdded] = useState(false);
  if (!p) return <div className="page narrow center"><h1>Piece not found</h1><Link to="/shop" className="btn">Back to shop</Link></div>;
  const inBag = bag.filter(i => i.id === p.id).reduce((a, i) => a + i.qty, 0), left = p.stock - inBag;
  const related = data.products.filter(x => x.active && x.category === p.category && x.id !== p.id).slice(0, 4);
  const add = () => { addToCart(p.id, option || p.options[0], qty); setAdded(true); };
  return (
    <div className="page">
      <nav className="crumbs"><Link to="/shop">Shop</Link> / <Link to={'/shop?c=' + p.category}>{p.category}</Link> / <span>{p.name}</span></nav>
      <div className="pdp">
        <div className="pdp-img"><img src={img(p.image)} alt={p.name} /></div>
        <div className="pdp-info">
          <p className="eyebrow">{p.tag}</p>
          <h1>{p.name}</h1>
          <p className="pdp-price">{money(p.price)}</p>
          <p className="muted small">or 3 × {money(installment(p.price)[0])} with instalments (demo)</p>
          <p>{p.description}</p>
          <p className="muted small">Finish: {p.finish}</p>
          {p.options.length > 1 && <fieldset className="options"><legend>Size</legend>{p.options.map(o => <button key={o} type="button" className={'chip' + (option === o ? ' on' : '')} onClick={() => setOption(o)}>{o}</button>)}</fieldset>}
          <div className="row">
            <div className="qty"><button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Fewer">−</button><span>{qty}</span><button onClick={() => setQty(Math.min(10, left, qty + 1))} aria-label="More">+</button></div>
            <button className="btn grow" disabled={left < qty} onClick={add}>{p.stock <= 0 ? 'Sold out' : left < qty ? 'No more in stock' : 'Add to bag'}</button>
          </div>
          {added && <p className="notice ok">Added to your bag. <Link to="/bag">View bag →</Link></p>}
          <p className="muted small">{p.stock > 0 ? (p.stock < 5 ? `Only ${p.stock} left in the demo inventory` : 'In stock · ships in 1–2 days') : 'Currently unavailable'}</p>
          <details open><summary>Details</summary><p className="muted">Sample product details. Nickel-free finish, presented in our ivory gift box.</p></details>
          <details><summary>Delivery & returns</summary><p className="muted">Island-wide delivery LKR 350 or free studio collection. 14-day exchanges on unworn pieces (sample policy).</p></details>
          <details><summary>Care</summary><p className="muted">Keep dry, store separately, and wipe with a soft cloth after wear. <Link to="/care">Full care guide</Link>.</p></details>
        </div>
      </div>
      {related.length > 0 && <section className="section flush"><h2>You may also <em>love.</em></h2><div className="pgrid">{related.map(p => <ProductCard key={p.id} p={p} />)}</div></section>}
    </div>
  );
}
