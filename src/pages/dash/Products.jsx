import { useState } from 'react';
import { useStore } from '../../lib/hooks.js';
import { money, img, product, CATEGORIES, IMAGES } from '../../lib/store.js';
import { Icon } from '../../components/ui.jsx';

const blank = { name: '', price: 5000, stock: 10, category: 'rings', image: IMAGES[0], active: true };

export default function Products() {
  const { data } = useStore(), [q, setQ] = useState(''), [edit, setEdit] = useState(null), [error, setError] = useState('');
  const list = data.products.filter(p => (p.name + p.category).toLowerCase().includes(q.toLowerCase()));
  const value = data.products.reduce((a, p) => a + p.price * p.stock, 0);
  const save = e => { e.preventDefault(); try { product({ ...edit, price: Number(edit.price), stock: Number(edit.stock) }); setEdit(null); } catch (err) { setError(err.message); } };
  const f = k => ({ value: edit[k], onChange: e => setEdit({ ...edit, [k]: e.target.value }) });
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1>Products</h1><p className="muted">{data.products.length} pieces · inventory value {money(value)}</p></div><button className="btn sm" onClick={() => { setEdit(blank); setError(''); }}>+ New product</button></div>
      <div className="toolbar"><label className="search"><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" /></label></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Piece</th><th>Category</th><th className="num">Price</th><th className="num">Stock</th><th>Visibility</th><th></th></tr></thead>
        <tbody>{list.map(p => (
          <tr key={p.id}>
            <td><span className="cell-img"><img src={img(p.image)} alt="" /><b>{p.name}</b></span></td>
            <td className="caps">{p.category}</td><td className="num">{money(p.price)}</td>
            <td className={'num ' + (p.stock === 0 ? 'down' : p.stock < 5 ? 'warn' : '')}>{p.stock}</td>
            <td><span className={'badge ' + (p.active ? 'b-delivered' : 'b-cancelled')}>{p.active ? 'Live' : 'Hidden'}</span></td>
            <td className="num"><button className="link" onClick={() => { setEdit({ ...p }); setError(''); }}>Edit</button></td>
          </tr>
        ))}</tbody>
      </table></div></div>

      {edit && (
        <div className="modal" onClick={() => setEdit(null)}>
          <form className="modal-card" onClick={e => e.stopPropagation()} onSubmit={save}>
            <h2>{edit.id ? 'Edit piece' : 'New piece'}</h2>
            <div className="fgrid">
              <label className="span2">Name<input required maxLength="70" {...f('name')} /></label>
              <label>Price (LKR)<input type="number" min="100" step="1" required {...f('price')} /></label>
              <label>Stock<input type="number" min="0" max="999" step="1" required {...f('stock')} /></label>
              <label>Category<select {...f('category')}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="check"><input type="checkbox" checked={edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })} /> Visible in store</label>
              <fieldset className="span2 img-pick"><legend>Sample photo</legend>{IMAGES.map(i => <button type="button" key={i} className={edit.image === i ? 'on' : ''} onClick={() => setEdit({ ...edit, image: i })}><img src={img(i)} alt={i} /></button>)}</fieldset>
            </div>
            {error && <p className="notice err">{error}</p>}
            <div className="row"><button className="btn">Save</button><button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
