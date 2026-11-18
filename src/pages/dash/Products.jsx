import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { useAuth, actorOf } from '../../lib/auth.jsx';
import { money, img, saveProduct, duplicateProduct, setProductStatus, adjustStock, saveCategory, saveMedia, mediaUsage, planImport, importProducts, suggestSku, IMAGES, OPTION_PRESETS, PRODUCT_STATUSES, CSV_TEMPLATE } from '../../lib/store.js';
import { resizeImage } from '../../lib/image.js';
import { Icon, fmtTime } from '../../components/ui.jsx';

const STATUS_BADGE = { active: 'b-delivered', draft: 'b-processing', archived: 'b-cancelled' };
const blank = cat => ({ name: '', category: cat, price: 5000, compareAt: '', status: 'draft', featured: false, images: [], description: '', finish: 'Gold tone', tag: 'New arrival', variants: [] });

export default function Products() {
  const [params, setParams] = useSearchParams(), tab = params.get('tab') || 'products', setTab = t => setParams(t === 'products' ? {} : { tab: t }, { replace: true });
  return (
    <div className="dash-page">
      <div className="chips tabs">{[['products', 'Products'], ['inventory', 'Inventory log'], ['waitlist', 'Waitlist'], ['categories', 'Categories'], ['import', 'Import CSV']].map(([k, l]) => <button key={k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'products' && <ProductList />}
      {tab === 'inventory' && <InventoryLog />}
      {tab === 'waitlist' && <Waitlist />}
      {tab === 'categories' && <Categories />}
      {tab === 'import' && <ImportCsv done={() => setTab('products')} />}
    </div>
  );
}

function ProductList() {
  const { data } = useStore(), { user } = useAuth(), actor = actorOf(user);
  const [q, setQ] = useState(''), [status, setStatus] = useState('all'), [cat, setCat] = useState('all'), [edit, setEdit] = useState(null), [stock, setStock] = useState(null), [error, setError] = useState('');
  const list = data.products.filter(p => (status === 'all' || p.status === status) && (cat === 'all' || p.category === cat) && (p.name + p.category + p.variants.map(v => v.sku).join(' ')).toLowerCase().includes(q.toLowerCase()));
  const value = data.products.filter(p => p.status !== 'archived').reduce((a, p) => a + p.variants.reduce((x, v) => x + (v.price ?? p.price) * v.stock, 0), 0);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const id = params.get('edit'), p = id && data.products.find(p => p.id === id);
    if (p) setEdit({ ...p, compareAt: p.compareAt ?? '' }); else if (params.get('new')) setEdit(blank(data.categories[0].slug));
    if (id || params.get('new')) setParams({}, { replace: true });
  }, [params.get('edit'), params.get('new')]);
  const run = fn => { setError(''); try { fn(); } catch (e) { setError(e.message); } };
  const catName = slug => data.categories.find(c => c.slug === slug)?.name || slug;
  return <>
    <div className="dash-head"><div><h1>Products</h1><p className="muted">{data.products.filter(p => p.status === 'active').length} live · {data.products.filter(p => p.status === 'draft').length} drafts · inventory value {money(value)}</p></div><button className="btn sm" onClick={() => setEdit(blank(data.categories[0].slug))}>+ New product</button></div>
    <div className="toolbar">
      <label className="search"><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or SKU" aria-label="Search products" /></label>
      <div className="row wrap">
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status"><option value="all">All statuses</option>{PRODUCT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Category"><option value="all">All categories</option>{data.categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
      </div>
    </div>
    {error && <p className="notice err">{error}</p>}
    <div className="card"><div className="table-wrap"><table>
      <thead><tr><th>Piece</th><th>Category</th><th className="num">Price</th><th>Stock by option</th><th>Status</th><th></th></tr></thead>
      <tbody>{list.map(p => (
        <tr key={p.id}>
          <td><span className="cell-img"><img src={img(p.image)} alt="" /><span><b>{p.name}</b>{p.featured && <small className="muted"> · featured</small>}<br /><small className="muted">{p.images.length} photo{p.images.length === 1 ? '' : 's'}</small></span></span></td>
          <td>{catName(p.category)}</td>
          <td className="num">{money(p.price)}{p.compareAt && <><br /><s className="muted small">{money(p.compareAt)}</s></>}</td>
          <td><div className="vchips">{p.variants.map(v => <button key={v.sku} className={'vchip ' + (v.stock === 0 ? 'out' : v.stock <= v.low ? 'low' : '')} onClick={() => setStock({ p, v, delta: 1, reason: 'restock', note: '' })} title={`${v.sku} · click to adjust stock`}>{v.option} <b>{v.stock}</b></button>)}</div></td>
          <td><span className={'badge ' + STATUS_BADGE[p.status]}>{p.status === 'active' ? 'Live' : p.status}</span></td>
          <td className="num"><div className="row end">
            <button className="link" onClick={() => setEdit({ ...p, compareAt: p.compareAt ?? '' })}>Edit</button>
            <button className="link" onClick={() => run(() => duplicateProduct(p.id, actor))}>Duplicate</button>
            {p.status === 'archived' ? <button className="link" onClick={() => run(() => setProductStatus(p.id, 'draft', actor))}>Restore</button> : <button className="link" onClick={() => confirm('Archive ' + p.name + '? It leaves the shop but old orders keep their record.') && run(() => setProductStatus(p.id, 'archived', actor))}>Archive</button>}
          </div></td>
        </tr>
      ))}</tbody>
    </table>{!list.length && <p className="empty">No products match.</p>}</div></div>
    {edit && <Editor initial={edit} categories={data.categories} actor={actor} close={() => setEdit(null)} />}
    {stock && <StockDialog s={stock} set={setStock} actor={actor} />}
  </>;
}

function StockDialog({ s, set, actor }) {
  const [error, setError] = useState('');
  const delta = Number(s.delta) * (s.reason === 'damaged' ? -1 : 1);
  return (
    <div className="modal" onClick={() => set(null)}>
      <form className="modal-card" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); try { adjustStock(s.p.id, s.v.sku, delta, s.reason, s.note, actor); set(null); } catch (err) { setError(err.message); } }}>
        <h2>Adjust stock</h2>
        <p className="muted">{s.p.name} · {s.v.option} · {s.v.sku}<br />Currently <b>{s.v.stock}</b> in stock → after: <b>{s.v.stock + (Number.isInteger(delta) ? delta : 0)}</b></p>
        <div className="fgrid">
          <label>Reason<select value={s.reason} onChange={e => set({ ...s, reason: e.target.value })}><option value="restock">Restock (add)</option><option value="return">Customer return (add)</option><option value="damaged">Damaged / lost (remove)</option><option value="adjustment">Stock count correction (±)</option></select></label>
          <label>{s.reason === 'adjustment' ? 'Change (use − to remove)' : 'Pieces'}<input type="number" step="1" min={s.reason === 'adjustment' ? -999 : 1} max="999" value={s.delta} onChange={e => set({ ...s, delta: e.target.value })} /></label>
          <label className="span2">Note<input value={s.note} onChange={e => set({ ...s, note: e.target.value })} placeholder="e.g. Workshop delivery #14" /></label>
        </div>
        {error && <p className="notice err">{error}</p>}
        <div className="row"><button className="btn">Save</button><button type="button" className="btn ghost" onClick={() => set(null)}>Cancel</button></div>
      </form>
    </div>
  );
}

function Editor({ initial, categories, actor, close }) {
  const [p, setP] = useState(() => ({ ...initial, variants: initial.variants.length ? initial.variants.map(v => ({ ...v, price: v.price ?? '' })) : [] }));
  const [error, setError] = useState(''), [uploading, setUploading] = useState(''), [drag, setDrag] = useState(null), fileRef = useRef();
  const f = k => ({ value: p[k], onChange: e => setP({ ...p, [k]: e.target.value }) });
  const presets = () => setP({ ...p, variants: (OPTION_PRESETS[p.category] || ['Standard']).map(o => p.variants.find(v => v.option === o) || { sku: suggestSku(p.name || 'piece', o), option: o, price: '', stock: 0, low: 2, active: true }) });
  const setV = (i, k, val) => setP({ ...p, variants: p.variants.map((v, j) => j === i ? { ...v, [k]: val } : v) });
  const addV = () => setP({ ...p, variants: [...p.variants, { sku: suggestSku(p.name || 'piece', 'opt' + (p.variants.length + 1)), option: '', price: '', stock: 0, low: 2, active: true, isNew: true }] });
  const files = async list => {
    setError(''); const room = 8 - p.images.length, picked = [...list].slice(0, room), added = [];
    if (list.length > room) setError(`Only ${room} more photo(s) fit (8 max).`);
    for (const [i, file] of picked.entries()) {
      setUploading(`Resizing ${i + 1} of ${picked.length}…`);
      try { added.push(saveMedia(await resizeImage(file))); } catch (e) { setError(e.message); }
    }
    setUploading(''); setP(cur => ({ ...cur, images: [...cur.images, ...added] }));
  };
  const move = (from, to) => { if (to < 0 || to >= p.images.length) return; const im = [...p.images]; const [x] = im.splice(from, 1); im.splice(to, 0, x); setP({ ...p, images: im }); };
  const save = e => {
    e.preventDefault(); setError('');
    try {
      saveProduct({ ...p, price: Number(p.price), compareAt: p.compareAt === '' || p.compareAt == null ? null : Number(p.compareAt), variants: p.variants.map(v => ({ ...v, option: v.option.trim(), sku: v.sku.trim().toUpperCase(), stock: Number(v.stock), low: Number(v.low), price: v.price === '' || v.price == null ? null : Number(v.price) })) }, actor);
      close();
    } catch (err) { setError(err.message); }
  };
  const usage = mediaUsage();
  return (
    <div className="modal" onClick={close}>
      <form className="modal-card wide" onClick={e => e.stopPropagation()} onSubmit={save}>
        <div className="card-head"><h2>{p.id ? 'Edit piece' : 'New piece'}</h2><button type="button" className="icon-btn" onClick={close} aria-label="Close"><Icon name="close" /></button></div>
        <div className="fgrid">
          <label className="span2">Name<input required maxLength="70" {...f('name')} /></label>
          <label>Category<select {...f('category')}>{categories.map(c => <option key={c.slug} value={c.slug}>{c.name}{c.active ? '' : ' (hidden)'}</option>)}</select></label>
          <label>Status<select {...f('status')}><option value="draft">Draft: not in shop</option><option value="active">Live in shop</option><option value="archived">Archived</option></select></label>
          <label>Price (LKR)<input type="number" min="100" step="1" required {...f('price')} /></label>
          <label>Compare-at price (optional)<input type="number" min="0" step="1" {...f('compareAt')} placeholder="Shows as a sale" /></label>
          <label>Finish<input maxLength="60" {...f('finish')} /></label>
          <label>Tag<input maxLength="30" {...f('tag')} placeholder="New arrival" /></label>
          <label className="span2">Description<textarea rows="3" maxLength="800" {...f('description')} /></label>
          <label className="check span2"><input type="checkbox" checked={p.featured} onChange={e => setP({ ...p, featured: e.target.checked })} /> Feature at the top of the shop</label>
        </div>

        <h4>Photos <span className="muted">· first photo is the cover · {p.images.length}/8</span></h4>
        <div className={'dropzone' + (drag === 'file' ? ' over' : '')} onDragOver={e => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setDrag('file'); }} onDragLeave={() => setDrag(null)} onDrop={e => { e.preventDefault(); setDrag(null); if (e.dataTransfer.files.length) files(e.dataTransfer.files); }}>
          <div className="photo-grid">
            {p.images.map((im, i) => (
              <figure key={im + i} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', String(i)); }} onDrop={e => { const from = e.dataTransfer.getData('text/plain'); if (from !== '') { e.stopPropagation(); e.preventDefault(); move(Number(from), i); } }} onDragOver={e => e.preventDefault()}>
                <img src={img(im)} alt="" />
                {i === 0 && <span className="cover">Cover</span>}
                <figcaption>
                  <button type="button" onClick={() => move(i, i - 1)} disabled={!i} aria-label="Move left">←</button>
                  {i > 0 && <button type="button" onClick={() => move(i, 0)} title="Make cover">★</button>}
                  <button type="button" onClick={() => setP({ ...p, images: p.images.filter((_, j) => j !== i) })} aria-label="Remove">✕</button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === p.images.length - 1} aria-label="Move right">→</button>
                </figcaption>
              </figure>
            ))}
            {p.images.length < 8 && <button type="button" className="add-photo" onClick={() => fileRef.current.click()}><Icon name="upload" /><span>Upload photos</span><small>or drop files here</small></button>}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => { files(e.target.files); e.target.value = ''; }} />
          {uploading && <p className="small">{uploading}</p>}
          <details className="sample-pick"><summary>Or use a sample photo</summary><div className="img-pick">{IMAGES.map(i => <button type="button" key={i} className={p.images.includes(i) ? 'on' : ''} onClick={() => p.images.length < 8 && !p.images.includes(i) && setP({ ...p, images: [...p.images, i] })}><img src={img(i)} alt={i} /></button>)}</div></details>
          <p className="muted small">JPG, PNG or WebP up to 8 MB. Photos are resized to 1000 px in your browser and stored in demo storage ({usage.count} uploaded · {usage.kb} KB of ~5 MB).</p>
        </div>

        <div className="card-head"><h4>Sizes / options & stock</h4><button type="button" className="link" onClick={presets}>Use {p.category} presets</button></div>
        <div className="table-wrap"><table className="vtable">
          <thead><tr><th>Option</th><th>SKU</th><th>Price override</th><th>Stock</th><th>Low at</th><th>Sell</th><th></th></tr></thead>
          <tbody>{p.variants.map((v, i) => (
            <tr key={i}>
              <td><input value={v.option} onChange={e => setV(i, 'option', e.target.value)} placeholder="US 6" aria-label="Option" /></td>
              <td><input value={v.sku} onChange={e => setV(i, 'sku', e.target.value.toUpperCase())} aria-label="SKU" /></td>
              <td><input type="number" min="0" value={v.price} onChange={e => setV(i, 'price', e.target.value)} placeholder={String(p.price)} aria-label="Price override" /></td>
              <td><input type="number" min="0" max="999" value={v.stock} onChange={e => setV(i, 'stock', e.target.value)} aria-label="Stock" /></td>
              <td><input type="number" min="0" max="99" value={v.low} onChange={e => setV(i, 'low', e.target.value)} aria-label="Low stock alert" /></td>
              <td className="center"><input type="checkbox" checked={v.active} onChange={e => setV(i, 'active', e.target.checked)} aria-label="Sell this option" /></td>
              <td>{(v.isNew || !initial.variants.some(x => x.sku === v.sku)) && <button type="button" className="link" onClick={() => setP({ ...p, variants: p.variants.filter((_, j) => j !== i) })}>Remove</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
        {!p.variants.length && <p className="muted small">No options yet. Use the presets or add one.</p>}
        <button type="button" className="btn sm ghost" onClick={addV}>+ Add option</button>
        <p className="muted small">Stock changes here are logged as “adjustment”. For deliveries, use the stock chips on the product list to record a reason. Saved options can be turned off but not removed, because past orders refer to their SKU.</p>
        {error && <p className="notice err">{error}</p>}
        <div className="row"><button className="btn" disabled={!!uploading}>Save piece</button><button type="button" className="btn ghost" onClick={close}>Cancel</button></div>
      </form>
    </div>
  );
}

function InventoryLog() {
  const { data } = useStore(), [reason, setReason] = useState('all'), [q, setQ] = useState('');
  const names = Object.fromEntries(data.products.map(p => [p.id, p.name]));
  const list = data.movements.filter(m => (reason === 'all' || m.reason === reason) && ((names[m.productId] || '') + m.sku + (m.orderId || '')).toLowerCase().includes(q.toLowerCase()));
  return <>
    <div className="dash-head"><div><h1>Inventory log</h1><p className="muted">Every stock change with who made it and why. Totals always match the product list.</p></div></div>
    <div className="toolbar">
      <label className="search"><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Piece, SKU or order" aria-label="Search log" /></label>
      <div className="chips">{['all', 'restock', 'order', 'cancel', 'return', 'adjustment', 'damaged'].map(r => <button key={r} className={'chip' + (reason === r ? ' on' : '')} onClick={() => setReason(r)}>{r}</button>)}</div>
    </div>
    <div className="card"><div className="table-wrap"><table>
      <thead><tr><th>When</th><th>Piece</th><th>SKU</th><th>Reason</th><th className="num">Change</th><th>By</th><th>Note / order</th></tr></thead>
      <tbody>{list.slice(0, 300).map(m => <tr key={m.id}><td className="small">{fmtTime(m.date)}</td><td>{names[m.productId] || m.productId}<br /><small className="muted">{m.option}</small></td><td className="small">{m.sku}</td><td className="caps">{m.reason}</td><td className={'num ' + (m.delta > 0 ? 'up' : 'down')}>{m.delta > 0 ? '+' : ''}{m.delta}</td><td className="small">{m.by}</td><td className="small">{m.orderId || m.note}</td></tr>)}</tbody>
    </table>{!list.length && <p className="empty">No stock changes match.</p>}</div></div>
  </>;
}

function Categories() {
  const { data } = useStore(), { user } = useAuth(), actor = actorOf(user), [name, setName] = useState(''), [error, setError] = useState('');
  const run = fn => { setError(''); try { fn(); } catch (e) { setError(e.message); } };
  return <>
    <div className="dash-head"><div><h1>Categories</h1><p className="muted">Hidden categories disappear from the shop filters along with their pieces.</p></div></div>
    <div className="card">
      <table><thead><tr><th>Name</th><th>Slug</th><th className="num">Pieces</th><th>Shown</th></tr></thead>
        <tbody>{data.categories.map(c => <tr key={c.slug}>
          <td><input defaultValue={c.name} onBlur={e => e.target.value !== c.name && run(() => saveCategory({ ...c, name: e.target.value }, actor))} aria-label="Category name" /></td>
          <td className="small muted">{c.slug}</td><td className="num">{data.products.filter(p => p.category === c.slug).length}</td>
          <td><label className="check inline"><input type="checkbox" checked={c.active} onChange={e => run(() => saveCategory({ ...c, active: e.target.checked }, actor))} /> {c.active ? 'Shown' : 'Hidden'}</label></td>
        </tr>)}</tbody></table>
      <form className="row" onSubmit={e => { e.preventDefault(); run(() => { saveCategory({ name }, actor); setName(''); }); }}><input value={name} onChange={e => setName(e.target.value)} placeholder="New category, e.g. Anklets" /><button className="btn sm">Add</button></form>
      {error && <p className="notice err">{error}</p>}
    </div>
  </>;
}

function ImportCsv({ done }) {
  const { user } = useAuth(), actor = actorOf(user), [text, setText] = useState(''), [result, setResult] = useState(null);
  const plan = text.trim() ? planImport(text) : null;
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' })); a.download = 'romanz-products-template.csv'; a.click(); };
  return <>
    <div className="dash-head"><div><h1>Import products</h1><p className="muted">Load a whole catalogue from a spreadsheet. Rows with the same name become one piece with several options. Existing pieces (matched by name) are updated.</p></div></div>
    <div className="card">
      <div className="row wrap"><label className="btn sm ghost file-btn">Choose CSV file<input type="file" accept=".csv,text/csv" hidden onChange={async e => { const f = e.target.files[0]; if (f) setText(await f.text()); setResult(null); }} /></label><button className="btn sm ghost" onClick={download}>Download template</button><button className="link" onClick={() => { setText(CSV_TEMPLATE); setResult(null); }}>Paste the sample</button></div>
      <label>CSV<textarea rows="7" className="mono" value={text} onChange={e => { setText(e.target.value); setResult(null); }} placeholder="name,category,price,option,sku,stock,image,status,description,finish" /></label>
      <p className="muted small">Columns: <b>name, category, price</b> are required. Option defaults to “Standard” and SKU is generated if empty. Image can be a sample path (e.g. ring.jpg) or an https:// URL. Status: draft, active or archived. New pieces default to draft.</p>
    </div>
    {plan && <div className="card">
      <h3>Preview</h3>
      {plan.errors.map((e, i) => <p key={i} className="notice err small">{e}</p>)}
      <table><thead><tr><th>Piece</th><th>Action</th><th>Options</th><th>Status</th></tr></thead>
        <tbody>{plan.items.map((it, i) => <tr key={i}><td><span className="cell-img">{it.input.images[0] && <img src={img(it.input.images[0])} alt="" />}<b>{it.input.name}</b></span></td><td>{!it.ok ? <span className="down">Skip</span> : it.existing ? 'Update' : 'Create'}</td><td className="small">{it.input.variants.map(v => `${v.option} (${v.stock})`).join(', ')}</td><td className="caps">{it.input.status}</td></tr>)}</tbody></table>
      <div className="row"><button className="btn sm" disabled={!plan.items.some(i => i.ok)} onClick={() => { try { setResult(importProducts(text, actor)); setText(''); } catch (e) { setResult({ errors: [e.message], created: 0, updated: 0 }); } }}>Import {plan.items.filter(i => i.ok).length} piece(s)</button></div>
    </div>}
    {result && <div className="card"><p className="notice ok">{result.created} created · {result.updated} updated{result.errors.length ? ` · ${result.errors.length} skipped` : ''}.</p><button className="btn sm" onClick={done}>View products</button></div>}
  </>;
}

function Waitlist() {
  const { data } = useStore(), [show, setShow] = useState('waiting');
  const names = Object.fromEntries(data.products.map(p => [p.id, p]));
  const list = data.alerts.filter(a => show === 'all' || (show === 'waiting' ? !a.notified : a.notified));
  const demand = Object.values(data.alerts.filter(a => !a.notified).reduce((m, a) => { (m[a.sku] ||= { ...a, n: 0 }).n++; return m; }, {})).sort((a, b) => b.n - a.n);
  return <>
    <div className="dash-head"><div><h1>Waitlist</h1><p className="muted">Customers who asked to hear when a sold-out size comes back. Restock it and they’re emailed automatically, once.</p></div></div>
    {demand.length > 0 && <div className="card"><h3>Most wanted</h3><div className="vchips">{demand.slice(0, 10).map(d => <span key={d.sku} className="vchip out">{names[d.productId]?.name} · {d.option} <b>{d.n}</b></span>)}</div></div>}
    <div className="toolbar"><div className="chips">{[['waiting', 'Waiting'], ['sent', 'Notified'], ['all', 'All']].map(([k, l]) => <button key={k} className={'chip' + (show === k ? ' on' : '')} onClick={() => setShow(k)}>{l}</button>)}</div></div>
    <div className="card"><div className="table-wrap"><table>
      <thead><tr><th>Piece</th><th>Option</th><th>Email</th><th>Asked</th><th>Current stock</th><th>Notified</th></tr></thead>
      <tbody>{list.map(a => { const p = names[a.productId], v = p?.variants.find(v => v.sku === a.sku); return <tr key={a.id}><td><span className="cell-img">{p && <img src={img(p.image)} alt="" />}<b>{p?.name || a.productId}</b></span></td><td>{a.option}</td><td>{a.email}</td><td className="small">{fmtTime(a.date)}</td><td className={v?.stock ? 'up' : 'down'}>{v?.stock ?? '—'}</td><td className="small">{a.notified ? fmtTime(a.notified) : '—'}</td></tr>; })}</tbody>
    </table>{!list.length && <p className="empty">Nobody on this list.</p>}</div></div>
  </>;
}
