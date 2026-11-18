import { Link, useParams } from 'react-router-dom';
import { img } from '../../lib/store.js';
import { POSTS } from '../../lib/content.js';
import { fmtDate } from '../../components/ui.jsx';

export function Story() {
  return (
    <div className="page">
      <div className="page-head center"><p className="eyebrow">Our story</p><h1>Small details. <em>Lasting impressions.</em></h1></div>
      <div className="split flush">
        <img src="/earrings.jpg" alt="Gold necklace and earrings on display stands" />
        <div className="split-copy">
          <h2>Born in Colombo, <em>made for every day.</em></h2>
          <p>ROMANZ began with a simple idea: jewellery should not wait in a drawer for a special occasion. It should be part of the ordinary moments too: a morning coffee, a first meeting, a quiet celebration.</p>
          <p>Each piece is chosen for modern silhouettes, delicate details and a warm golden glow. We keep our collection small on purpose, so every style feels considered. (Sample brand story; replace with the client’s own.)</p>
        </div>
      </div>
      <section className="section values">
        {[['2019', 'The first sketch', 'A notebook of sunburst rings and fine chains.'], ['2022', 'The studio opens', 'A sun-filled sample studio on Flower Road.'], ['2024', 'The Heritage edit', 'Occasion pieces inspired by Sri Lankan craft.'], ['2026', 'Online, island-wide', 'Delivered to your door, gift-wrapped.']].map(([y, t, d]) => <div key={y}><p className="big-num">{y}</p><h3>{t}</h3><p className="muted">{d}</p></div>)}
      </section>
    </div>
  );
}

export function Care() {
  const tips = [['Keep it dry', 'Remove jewellery before swimming, showering or exercise. Moisture dulls a golden finish.'], ['Last on, first off', 'Apply perfume, lotion and hairspray before your jewellery, and take pieces off first at night.'], ['Store separately', 'Use the soft pouch or ivory box so pieces do not scratch or tangle. Add a silica sachet in monsoon season.'], ['Clean gently', 'Wipe with a soft, dry microfibre cloth after wear. Avoid chemicals and abrasive polishes.'], ['Rings & sizing', 'Fingers change with temperature. Size in the afternoon for the most comfortable fit.'], ['Complimentary polish', 'Bring any ROMANZ piece to the studio for a free polish, any time. (Sample service.)']];
  return (
    <div className="page">
      <div className="page-head center"><p className="eyebrow">Jewellery care</p><h1>Keep your <em>glow.</em></h1><p className="muted">A few gentle habits keep every piece looking its best.</p></div>
      <div className="care-grid">{tips.map(([t, d], i) => <div key={t} className="panel"><p className="big-num">0{i + 1}</p><h3>{t}</h3><p className="muted">{d}</p></div>)}</div>
    </div>
  );
}

export function Journal() {
  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">The journal</p><h1>Stories, styling & <em>care.</em></h1></div>
      <div className="post-grid">
        {POSTS.map(p => (
          <Link key={p.slug} to={'/journal/' + p.slug} className="post-card">
            <img src={img(p.image)} alt="" loading="lazy" />
            <p className="eyebrow">{p.tag} · {p.read}</p><h3>{p.title}</h3><p className="muted small">{fmtDate(p.date)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Post() {
  const p = POSTS.find(p => p.slug === useParams().slug);
  if (!p) return <div className="page narrow center"><h1>Story not found</h1><Link to="/journal" className="btn">Back to journal</Link></div>;
  return (
    <article className="page narrow">
      <Link to="/journal" className="muted small">← The journal</Link>
      <p className="eyebrow">{p.tag} · {p.read} · {fmtDate(p.date)}</p>
      <h1>{p.title}</h1>
      <img className="post-hero" src={img(p.image)} alt="" />
      {p.body.map((para, i) => <p key={i} className="prose">{para}</p>)}
      <Link to="/shop" className="btn">Shop the edit</Link>
    </article>
  );
}
