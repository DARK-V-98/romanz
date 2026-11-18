import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { img } from '../../lib/store.js';
import { TESTIMONIALS, POSTS } from '../../lib/content.js';
import { ProductCard, Icon, fmtDate } from '../../components/ui.jsx';

const CATS = [['rings', 'Rings', 'ring.jpg'], ['necklaces', 'Necklaces', 'necklace.jpg'], ['earrings', 'Earrings', 'products/hoops.jpg'], ['sets', 'Occasion sets', 'products/bracelet.jpg']];

export default function Home() {
  const { data } = useStore(), [joined, setJoined] = useState(false);
  const live = data.products.filter(p => p.active);
  const best = ['signature-ring', 'aurora-ring', 'luna-hoops', 'golden-hour'].map(id => live.find(p => p.id === id)).filter(Boolean);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">The Autumn Edit · 2026</p>
          <h1>A little everyday <em>extraordinary.</em></h1>
          <p className="lead">Jewellery for the moments that become memories. Modern silhouettes, delicate details, and a glow that feels beautifully like you.</p>
          <div className="row">
            <Link to="/shop" className="btn">Shop the collection</Link>
            <Link to="/story" className="btn ghost">Our story</Link>
          </div>
          <dl className="hero-stats">
            <div><dt>18</dt><dd>signature styles</dd></div>
            <div><dt>4.9★</dt><dd>sample rating</dd></div>
            <div><dt>2 days</dt><dd>island-wide delivery</dd></div>
          </dl>
        </div>
        <div className="hero-art">
          <img src="/hero.jpg" alt="Gold rings worn on a hand" fetchpriority="high" />
          <Link to="/shop/signature-ring" className="hero-chip"><img src="/ring.jpg" alt="" /><span><b>The Signature Ring</b><small>Bestseller · from LKR 5,900</small></span></Link>
        </div>
      </section>

      <div className="marquee" aria-hidden="true"><div>{Array(2).fill(['Made to be worn', 'Meant to be loved', 'Modern classics', 'Effortless elegance', 'Your everyday signature']).flat().map((t, i) => <span key={i}>✦ {t}</span>)}</div></div>

      <section className="section">
        <div className="sec-head"><div><p className="eyebrow">Shop by category</p><h2>Find your <em>signature.</em></h2></div><Link to="/shop" className="link-arrow">View all <Icon name="arrow" size={16} /></Link></div>
        <div className="cat-grid">
          {CATS.map(([c, label, im]) => (
            <Link key={c} to={'/shop?c=' + c} className="cat-tile">
              <img src={img(im)} alt="" loading="lazy" />
              <span>{label}<small>{live.filter(p => p.category === c).length} styles</small></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section tint">
        <div className="sec-head"><div><p className="eyebrow">Most loved</p><h2>This season’s <em>favourites.</em></h2></div><p className="muted">Little luxuries, chosen by you.</p></div>
        <div className="pgrid">{best.map(p => <ProductCard key={p.id} p={p} />)}</div>
      </section>

      <section className="split">
        <img src="/necklace.jpg" alt="Gold chain necklace on a white surface" loading="lazy" />
        <div className="split-copy">
          <p className="eyebrow">The golden edit</p>
          <h2>Layer it. Stack it. <em>Make it yours.</em></h2>
          <p>Fine chains, playful charms and polished links designed to be worn together. Start with one piece you love and build a story around it, one moment at a time.</p>
          <ul className="ticks"><li>Hypoallergenic, nickel-free sample finishes</li><li>Free resizing within 30 days</li><li>Signature ivory gift box with every order</li></ul>
          <Link to="/shop?c=necklaces" className="btn">Shop necklaces</Link>
        </div>
      </section>

      <section className="section values">
        {[['truck', 'Island-wide delivery', 'Colombo in 1–2 days, everywhere else in 2–4. Free studio collection.'], ['gift', 'Gift-ready, always', 'Ivory box, satin ribbon and a handwritten note at no extra cost.'], ['shield', 'Pay your way', 'Card, cash on delivery or three easy instalments (all simulated here).'], ['spark', 'Care for life', 'Complimentary polishing and a care guide to keep every piece glowing.']].map(([i, t, d]) => (
          <div key={t}><span className="vicon"><Icon name={i} size={22} /></span><h3>{t}</h3><p className="muted">{d}</p></div>
        ))}
      </section>

      <section className="section dark">
        <p className="eyebrow center">Kind words</p>
        <div className="quotes">
          {TESTIMONIALS.map(t => <figure key={t.name}><blockquote>“{t.quote}”</blockquote><figcaption>{t.name} · {t.place}</figcaption></figure>)}
        </div>
      </section>

      <section className="section">
        <div className="sec-head"><div><p className="eyebrow">The journal</p><h2>Stories, styling & <em>care.</em></h2></div><Link to="/journal" className="link-arrow">All stories <Icon name="arrow" size={16} /></Link></div>
        <div className="post-grid">
          {POSTS.map(p => (
            <Link key={p.slug} to={'/journal/' + p.slug} className="post-card">
              <img src={img(p.image)} alt="" loading="lazy" />
              <p className="eyebrow">{p.tag} · {p.read}</p><h3>{p.title}</h3><p className="muted small">{fmtDate(p.date)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="newsletter">
        <div>
          <p className="eyebrow">The ROMANZ Circle</p>
          <h2>Ten percent off your first piece.</h2>
          <p className="muted">New arrivals, styling notes and early access. No spam, just sparkle. (Demo: nothing is sent.)</p>
        </div>
        {joined ? <p className="notice ok">You’re on the list ✦ welcome to the Circle.</p> : (
          <form className="inline-form" onSubmit={e => { e.preventDefault(); setJoined(true); }}>
            <input type="email" required placeholder="Your email address" aria-label="Email address" />
            <button className="btn">Join</button>
          </form>
        )}
      </section>
    </>
  );
}
