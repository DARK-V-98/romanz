import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { money, img, addToCart, installment, variantOf } from '../../lib/store.js';
import { ProductCard } from '../../components/ui.jsx';

export default function Product() { const { id } = useParams(); return <ProductView key={id} id={id} />; }

function ProductView({ id }) {
  const { data, bag } = useStore();
  const p = data.products.find(p => p.id === id && p.active);
  const [option, setOption] = useState(() => (p?.variants.find(v => v.active && v.stock > 0) || p?.variants[0])?.option);
  const [qty, setQty] = useState(1), [added, setAdded] = useState(false), [shot, setShot] = useState(0);
  if (!p) return <div className="page narrow center"><h1>Piece not found</h1><Link to="/shop" className="btn">Back to shop</Link></div>;
  const v = variantOf(p, option), price = v?.price ?? p.price;
  const inBag = bag.filter(i => i.id === p.id && i.option === option).reduce((a, i) => a + i.qty, 0), left = (v?.stock || 0) - inBag;
  const related = data.products.filter(x => x.active && x.category === p.category && x.id !== p.id).slice(0, 4);
  const add = () => { addToCart(p.id, option, qty); setAdded(true); };
  const { shippingFee, freeShippingOver } = data.settings;
  return (
    <div className="page">
      <nav className="crumbs"><Link to="/shop">Shop</Link> / <Link to={'/shop?c=' + p.category}>{p.category}</Link> / <span>{p.name}</span></nav>
      <div className="pdp">
        <div className="pdp-img">
          <img src={img(p.images[shot] || p.image)} alt={p.name} />
          {p.images.length > 1 && <div className="thumbs">{p.images.map((im, i) => <button key={im + i} className={shot === i ? 'on' : ''} onClick={() => setShot(i)} aria-label={'Photo ' + (i + 1)}><img src={img(im)} alt="" /></button>)}</div>}
        </div>
        <div className="pdp-info">
          <p className="eyebrow">{p.tag}</p>
          <h1>{p.name}</h1>
          <p className="pdp-price">{money(price)}{p.compareAt && <s className="muted small"> {money(p.compareAt)}</s>}</p>
          <p className="muted small">or 3 × {money(installment(price)[0])} with instalments (demo)</p>
          <p>{p.description}</p>
          {p.finish && <p className="muted small">Finish: {p.finish}</p>}
          {p.options.length > 1 && <fieldset className="options"><legend>Size</legend>{p.variants.filter(x => x.active).map(x => <button key={x.sku} type="button" className={'chip' + (option === x.option ? ' on' : '') + (x.stock ? '' : ' strike')} onClick={() => { setOption(x.option); setQty(1); setAdded(false); }} title={x.stock ? x.stock + ' in stock' : 'Sold out'}>{x.option}</button>)}</fieldset>}
          <div className="row">
            <div className="qty"><button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Fewer">−</button><span>{qty}</span><button onClick={() => setQty(Math.min(10, Math.max(1, left), qty + 1))} aria-label="More">+</button></div>
            <button className="btn grow" disabled={!v || left < qty} onClick={add}>{!v || v.stock <= 0 ? 'Sold out' : left < qty ? 'No more in stock' : 'Add to bag'}</button>
          </div>
          {added && <p className="notice ok">Added to your bag. <Link to="/bag">View bag →</Link></p>}
          <p className="muted small">{v?.stock > 0 ? (v.stock <= 3 ? `Only ${v.stock} left in ${option}` : 'In stock · ships in 1–2 days') : 'This size is currently unavailable'}</p>
          <details open><summary>Details</summary><p className="muted">Sample product details. Nickel-free finish, presented in our ivory gift box. SKU {v?.sku}.</p></details>
          <details><summary>Delivery & returns</summary><p className="muted">Island-wide delivery {money(shippingFee)}{freeShippingOver ? `, free over ${money(freeShippingOver)}` : ''}, or free studio collection. 14-day returns on unworn pieces (sample policy). Track your order any time at <Link to="/track">/track</Link>.</p></details>
          <details><summary>Care</summary><p className="muted">Keep dry, store separately, and wipe with a soft cloth after wear. <Link to="/care">Full care guide</Link>.</p></details>
        </div>
      </div>
      {related.length > 0 && <section className="section flush"><h2>You may also <em>love.</em></h2><div className="pgrid">{related.map(p => <ProductCard key={p.id} p={p} />)}</div></section>}
    </div>
  );
}
