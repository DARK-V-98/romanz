import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { useAuth } from '../../lib/auth.jsx';
import { money, img, addToCart, installment, variantOf, ratingOf, submitReview, subscribeAlert, markViewed, recentlyViewed } from '../../lib/store.js';
import { ProductCard, Stars, WishButton, fmtDate } from '../../components/ui.jsx';

export default function Product() { const { id } = useParams(); return <ProductView key={id} id={id} />; }

function ProductView({ id }) {
  const { data, bag } = useStore();
  const p = data.products.find(p => p.id === id && p.active);
  const [option, setOption] = useState(() => (p?.variants.find(v => v.active && v.stock > 0) || p?.variants[0])?.option);
  const [qty, setQty] = useState(1), [added, setAdded] = useState(false), [shot, setShot] = useState(0), [seen] = useState(() => recentlyViewed().filter(x => x !== id));
  useEffect(() => { if (p) markViewed(p.id); }, [p?.id]);
  if (!p) return <div className="page narrow center"><h1>Piece not found</h1><Link to="/shop" className="btn">Back to shop</Link></div>;
  const v = variantOf(p, option), price = v?.price ?? p.price;
  const inBag = bag.filter(i => i.id === p.id && i.option === option).reduce((a, i) => a + i.qty, 0), left = (v?.stock || 0) - inBag;
  const related = data.products.filter(x => x.active && x.category === p.category && x.id !== p.id).slice(0, 4);
  const add = () => { addToCart(p.id, option, qty); setAdded(true); };
  const { shippingFee, freeShippingOver } = data.settings, rating = ratingOf(data, p.id);
  const recent = seen.map(x => data.products.find(p => p.id === x && p.active)).filter(Boolean).slice(0, 4);
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
          <div className="row spread title-row"><h1>{p.name}</h1><WishButton id={p.id} className="big" /></div>
          {rating.count > 0 && <a href="#reviews" className="rating-link"><Stars value={rating.avg} /> <span className="small">{rating.avg} · {rating.count} review{rating.count === 1 ? '' : 's'}</span></a>}
          <p className="pdp-price">{money(price)}{p.compareAt && <s className="muted small"> {money(p.compareAt)}</s>}</p>
          <p className="muted small">or 3 × {money(installment(price)[0])} with instalments (demo)</p>
          <p>{p.description}</p>
          {p.finish && <p className="muted small">Finish: {p.finish}</p>}
          {p.options.length > 1 && <fieldset className="options"><legend>Size</legend>{p.variants.filter(x => x.active).map(x => <button key={x.sku} type="button" className={'chip' + (option === x.option ? ' on' : '') + (x.stock ? '' : ' strike')} onClick={() => { setOption(x.option); setQty(1); setAdded(false); }} title={x.stock ? x.stock + ' in stock' : 'Sold out'}>{x.option}</button>)}</fieldset>}
          <div className="row">
            <div className="qty"><button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Fewer">−</button><span>{qty}</span><button onClick={() => setQty(Math.min(10, Math.max(1, left), qty + 1))} aria-label="More">+</button></div>
            <button className="btn grow" disabled={!v || left < qty} onClick={add}>{!v || v.stock <= 0 ? 'Sold out' : left < qty ? 'No more in stock' : 'Add to bag'}</button>
          </div>
          {v && v.stock <= 0 && <BackInStock p={p} option={option} />}
          {added && <p className="notice ok">Added to your bag. <Link to="/bag">View bag →</Link></p>}
          <p className="muted small">{v?.stock > 0 ? (v.stock <= 3 ? `Only ${v.stock} left in ${option}` : 'In stock · ships in 1–2 days') : 'This size is currently unavailable'}</p>
          <details open><summary>Details</summary><p className="muted">Sample product details. Nickel-free finish, presented in our ivory gift box. SKU {v?.sku}.</p></details>
          <details><summary>Delivery & returns</summary><p className="muted">Island-wide delivery {money(shippingFee)}{freeShippingOver ? `, free over ${money(freeShippingOver)}` : ''}, or free studio collection. 14-day returns on unworn pieces (sample policy). Track your order any time at <Link to="/track">/track</Link>.</p></details>
          <details><summary>Care</summary><p className="muted">Keep dry, store separately, and wipe with a soft cloth after wear. <Link to="/care">Full care guide</Link>.</p></details>
        </div>
      </div>
      <Reviews p={p} rating={rating} />
      {related.length > 0 && <section className="section flush"><h2>You may also <em>love.</em></h2><div className="pgrid">{related.map(p => <ProductCard key={p.id} p={p} />)}</div></section>}
      {recent.length > 0 && <section className="section flush"><h2>Recently <em>viewed.</em></h2><div className="pgrid">{recent.map(p => <ProductCard key={p.id} p={p} />)}</div></section>}
    </div>
  );
}

function BackInStock({ p, option }) {
  const { user } = useAuth(), [email, setEmail] = useState(user?.email || ''), [msg, setMsg] = useState(null);
  return (
    <form className="alert-box" onSubmit={e => { e.preventDefault(); try { setMsg(['ok', subscribeAlert(p.id, option, email) ? `We’ll email ${email} as soon as ${option} is back.` : 'You’re already on the list for this size.']); } catch (err) { setMsg(['err', err.message]); } }}>
      <b>{option} is sold out.</b> Get an email when it’s back:
      <div className="row"><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email for back-in-stock alert" /><button className="btn sm">Notify me</button></div>
      {msg && <p className={'notice small ' + msg[0]}>{msg[1]}</p>}
    </form>
  );
}

function Reviews({ p, rating }) {
  const { data } = useStore(), { user } = useAuth(), [sort, setSort] = useState('new'), [open, setOpen] = useState(false), [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ rating: 0, title: '', body: '', name: user?.name || '', email: user?.email || '' });
  const list = data.reviews.filter(r => r.productId === p.id && r.status === 'published').sort((a, b) => sort === 'high' ? b.rating - a.rating : sort === 'low' ? a.rating - b.rating : b.date.localeCompare(a.date));
  const dist = [5, 4, 3, 2, 1].map(n => [n, list.filter(r => r.rating === n).length]);
  const f = k => ({ value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) });
  const submit = e => { e.preventDefault(); try { const r = submitReview({ ...form, productId: p.id }); setMsg(['ok', 'Thank you! Your review will appear once our team has checked it' + (r.verified ? ' (marked “verified buyer”).' : '.')]); setOpen(false); setForm({ ...form, rating: 0, title: '', body: '' }); } catch (err) { setMsg(['err', err.message]); } };
  return (
    <section className="section flush reviews" id="reviews">
      <div className="sec-head"><h2>Reviews<em>{rating.count ? ' · ' + rating.avg : ''}</em></h2><button className="btn sm ghost" onClick={() => { setOpen(!open); setMsg(null); }}>{open ? 'Close' : 'Write a review'}</button></div>
      {msg && <p className={'notice ' + msg[0]}>{msg[1]}</p>}
      {open && <form className="panel review-form" onSubmit={submit}>
        <fieldset className="star-input"><legend>Your rating</legend>{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} className={form.rating >= n ? 'on' : ''} onClick={() => setForm({ ...form, rating: n })} aria-label={n + ' stars'} aria-pressed={form.rating === n}>★</button>)}</fieldset>
        <div className="fgrid">
          <label>Name shown<input required maxLength="40" {...f('name')} /></label>
          <label>Email (never shown)<input type="email" required {...f('email')} /></label>
          <label className="span2">Title<input maxLength="80" {...f('title')} placeholder="Sum it up" /></label>
          <label className="span2">Review<textarea required rows="4" maxLength="1200" {...f('body')} placeholder="How does it look, feel and fit?" /></label>
        </div>
        <button className="btn sm">Submit review</button>
        <p className="muted small">Reviews are checked before they appear. If you bought this piece with the same email, it’s marked as a verified purchase.</p>
      </form>}
      {list.length ? <div className="review-grid">
        <aside className="dist"><b className="big-num">{rating.avg}</b><Stars value={rating.avg} size={18} /><p className="muted small">{rating.count} review{rating.count === 1 ? '' : 's'}</p>
          {dist.map(([n, c]) => <div key={n} className="hbar"><span>{n}★</span><div><i style={{ width: (c / list.length * 100) + '%' }} /></div><b>{c}</b></div>)}
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort reviews"><option value="new">Newest</option><option value="high">Highest rated</option><option value="low">Lowest rated</option></select>
        </aside>
        <ul className="review-list">{list.map(r => <li key={r.id}>
          <div className="row spread"><Stars value={r.rating} /><small className="muted">{fmtDate(r.date)}</small></div>
          {r.title && <h4 className="rtitle">{r.title}</h4>}<p>{r.body}</p>
          <small className="muted">{r.name}{r.verified && <span className="verified"> · ✓ Verified buyer</span>}</small>
          {r.reply && <div className="reply"><small className="muted">Reply from ROMANZ</small><p>{r.reply.body}</p></div>}
        </li>)}</ul>
      </div> : !open && <p className="muted">No reviews yet. Be the first to share how it looks on you.</p>}
    </section>
  );
}
