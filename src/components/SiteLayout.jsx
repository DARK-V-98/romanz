import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../lib/hooks.js';
import { useAuth, homeFor } from '../lib/auth.jsx';
import { Icon } from './ui.jsx';

const NAV = [['/shop', 'Shop'], ['/story', 'Our story'], ['/journal', 'Journal'], ['/care', 'Care'], ['/contact', 'Contact']];

export default function SiteLayout() {
  const { data, bag } = useStore(), { user } = useAuth(), [open, setOpen] = useState(false), loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const count = bag.reduce((a, i) => a + i.qty, 0);
  return (
    <>
      <div className="announce">{data.settings.announcement}</div>
      <header className="site-header">
        <button className="icon-btn mobile-only" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}><Icon name={open ? 'close' : 'menu'} /></button>
        <Link to="/" className="brand" aria-label="ROMANZ home">
          <img src="/logo.png" alt="" width="44" height="44" />
          <span>ROMANZ<small>JEWELLERY</small></span>
        </Link>
        <nav className={'main-nav' + (open ? ' open' : '')} aria-label="Main">
          {NAV.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
        </nav>
        <div className="header-actions">
          <Link to={user ? homeFor(user) : '/login'} className="icon-link" aria-label={user ? 'My account' : 'Sign in'}><Icon name="user" /><span className="desk-only">{user ? user.name.split(' ')[0] : 'Sign in'}</span></Link>
          <Link to="/bag" className="icon-link" aria-label="Bag"><Icon name="bag" /><span className="count">{count}</span></Link>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="site-footer">
        <div className="foot-grid">
          <div>
            <div className="brand light"><img src="/logo.png" alt="" width="40" height="40" /><span>ROMANZ<small>JEWELLERY</small></span></div>
            <p className="muted">A little everyday extraordinary. Designed in Colombo, made to be worn and loved.</p>
          </div>
          <div><h4>Shop</h4><Link to="/shop?c=rings">Rings</Link><Link to="/shop?c=necklaces">Necklaces</Link><Link to="/shop?c=earrings">Earrings</Link><Link to="/shop?c=sets">Occasion sets</Link></div>
          <div><h4>Help</h4><Link to="/care">Jewellery care</Link><Link to="/contact">Contact & FAQ</Link><Link to="/account">My orders</Link><Link to="/login">Staff login</Link></div>
          <div><h4>Visit</h4><p className="muted">Sample Studio, 42 Flower Road<br />Colombo 07, Sri Lanka<br />{data.settings.supportEmail}</p></div>
        </div>
        <div className="foot-bottom"><span>© 2026 ROMANZ Jewellery · Demo store, no real payments</span><span>Photography: Unsplash samples</span></div>
      </footer>
    </>
  );
}
