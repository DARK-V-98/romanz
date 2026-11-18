import { useSearchParams } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { ProductCard, Icon } from '../../components/ui.jsx';

const SORTS = { featured: (a, b) => (b.featured - a.featured), low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, name: (a, b) => a.name.localeCompare(b.name) };

export default function Shop() {
  const { data } = useStore(), [params, setParams] = useSearchParams();
  const c = params.get('c') || 'all', q = params.get('q') || '', sort = params.get('sort') || 'featured';
  const set = (k, v) => { const n = new URLSearchParams(params); v && v !== 'all' && v !== 'featured' ? n.set(k, v) : n.delete(k); setParams(n, { replace: true }); };
  const cats = data.categories.filter(x => x.active), live = new Set(cats.map(x => x.slug));
  const list = data.products.filter(p => p.active && live.has(p.category) && (c === 'all' || p.category === c) && (p.name + ' ' + p.finish + ' ' + p.category).toLowerCase().includes(q.toLowerCase())).sort(SORTS[sort]);
  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">The collection</p><h1>Shop <em>jewellery.</em></h1><p className="muted">Sample styles · Prices in LKR · Demo checkout</p></div>
      <div className="toolbar">
        <div className="chips" role="tablist">
          {[['all', 'All'], ...cats.map(x => [x.slug, x.name])].map(([k, l]) => <button key={k} role="tab" aria-selected={c === k} className={'chip' + (c === k ? ' on' : '')} onClick={() => set('c', k)}>{l}</button>)}
        </div>
        <div className="row">
          <label className="search"><Icon name="search" size={16} /><input value={q} onChange={e => set('q', e.target.value)} placeholder="Search pieces" aria-label="Search" /></label>
          <select value={sort} onChange={e => set('sort', e.target.value)} aria-label="Sort">
            <option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name A–Z</option>
          </select>
        </div>
      </div>
      <p className="muted small">{list.length} piece{list.length === 1 ? '' : 's'}</p>
      {list.length ? <div className="pgrid">{list.map(p => <ProductCard key={p.id} p={p} />)}</div> : <div className="empty">No pieces match that search. Try another word or category.</div>}
    </div>
  );
}
