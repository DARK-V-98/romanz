import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, ROLES, can } from '../../lib/auth.jsx';
import { useStore, useExpiryJob } from '../../lib/hooks.js';
import { Icon } from '../../components/ui.jsx';
import { NotificationBell, CommandPalette } from './Advanced.jsx';

const PERM = { discounts: 'products', reviews: 'products', outbox: 'inbox', returns: 'orders', reports: 'customers' };
const ITEMS = [['overview', '', 'grid', 'Overview'], ['orders', 'orders', 'box', 'Orders'], ['products', 'products', 'tag', 'Products'], ['customers', 'customers', 'users', 'Customers'], ['payments', 'payments', 'card', 'Payments'], ['returns', 'returns', 'undo', 'Returns'], ['reviews', 'reviews', 'star', 'Reviews'], ['discounts', 'discounts', 'gift', 'Discounts'], ['reports', 'reports', 'chart', 'Reports'], ['inbox', 'inbox', 'mail', 'Inbox'], ['outbox', 'outbox', 'send', 'Outbox'], ['team', 'team', 'shield', 'Team & roles'], ['settings', 'settings', 'cog', 'Settings']];

export default function DashLayout() {
  const { user, logout } = useAuth(), { data } = useStore(), [open, setOpen] = useState(false), loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useExpiryJob();
  const unread = data.messages.filter(m => !m.read).length, processing = data.orders.filter(o => o.status === 'Confirmed').length, openReturns = data.returns.filter(r => ['requested', 'approved'].includes(r.status)).length, pendingReviews = data.reviews.filter(r => r.status === 'pending').length;
  return (
    <div className="dash">
      <aside className={'side' + (open ? ' open' : '')}>
        <Link to="/" className="brand light"><img src="/logo.png" alt="" width="36" height="36" /><span>ROMANZ<small>STUDIO</small></span></Link>
        <nav>
          {ITEMS.filter(([perm]) => can(user, PERM[perm] || perm)).map(([perm, to, icon, label]) => (
            <NavLink key={perm} to={'/dashboard' + (to && '/' + to)} end={!to}>
              <Icon name={icon} size={18} /><span className="grow">{label}</span>
              {perm === 'inbox' && unread > 0 && <span className="pill">{unread}</span>}
              {perm === 'orders' && processing > 0 && <span className="pill">{processing}</span>}
              {perm === 'returns' && openReturns > 0 && <span className="pill">{openReturns}</span>}
              {perm === 'reviews' && pendingReviews > 0 && <span className="pill">{pendingReviews}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="me"><span className={'avatar r-' + user.role}>{user.name[0]}</span><span><b>{user.name}</b><small>{ROLES[user.role].label}</small></span></div>
          <Link to="/" className="side-link"><Icon name="arrow" size={16} /> View store</Link>
          <button className="side-link" onClick={logout}><Icon name="out" size={16} /> Sign out</button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="dash-main">
        <div className="dash-top">
          <button className="icon-btn mobile-only" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <span className="muted small">Demo workspace · all data is mock and stored in this browser</span>
          <CommandPalette />
          <NotificationBell />
          <span className={'role-tag r-' + user.role}>{ROLES[user.role].label}</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
