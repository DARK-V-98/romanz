import { Link } from 'react-router-dom';
import { useStore } from '../../lib/hooks.js';
import { useAuth } from '../../lib/auth.jsx';
import { wishlist } from '../../lib/store.js';
import { ProductCard } from '../../components/ui.jsx';

export default function Wishlist() {
  const { data } = useStore(), { user } = useAuth();
  const items = wishlist(user?.id, data).map(id => data.products.find(p => p.id === id)).filter(Boolean);
  const live = items.filter(p => p.active), gone = items.length - live.length;
  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Saved for later</p><h1>Your <em>wishlist.</em></h1>
        <p className="muted">{user ? 'Saved to your account, so it follows you on any device.' : <>Saved in this browser. <Link to="/login" state={{ from: '/wishlist' }}>Sign in</Link> to keep it in your account.</>}</p></div>
      {live.length ? <div className="pgrid">{live.map(p => <ProductCard key={p.id} p={p} />)}</div> : <div className="empty">Nothing saved yet. Tap the ♡ on any piece. <Link to="/shop">Browse the shop →</Link></div>}
      {gone > 0 && <p className="muted small">{gone} saved piece{gone === 1 ? ' is' : 's are'} no longer available.</p>}
    </div>
  );
}
