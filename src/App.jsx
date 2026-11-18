import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth, can } from './lib/auth.jsx';
import SiteLayout from './components/SiteLayout.jsx';
import DashLayout from './pages/dash/DashLayout.jsx';
import Home from './pages/site/Home.jsx';
import Shop from './pages/site/Shop.jsx';
import Product from './pages/site/Product.jsx';
import Bag from './pages/site/Bag.jsx';
import Checkout from './pages/site/Checkout.jsx';
import { Story, Care, Journal, Post } from './pages/site/Pages.jsx';
import Contact from './pages/site/Contact.jsx';
import Login from './pages/site/Login.jsx';
import Account from './pages/account/Account.jsx';
import Overview from './pages/dash/Overview.jsx';
import Orders from './pages/dash/Orders.jsx';
import Products from './pages/dash/Products.jsx';
import { Customers, Payments, Inbox, Team, Settings } from './pages/dash/Pages.jsx';

function Guard({ perm, role, children }) {
  const { user } = useAuth(), loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (role && user.role !== role) return <Navigate to={user.role === 'customer' ? '/account' : '/dashboard'} replace />;
  if (perm && !can(user, perm)) return <Navigate to={user.role === 'customer' ? '/account' : '/dashboard'} replace />;
  return children;
}

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const dash = (path, perm, El) => <Route path={path} element={<Guard perm={perm}><El /></Guard>} />;
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="shop/:id" element={<Product />} />
        <Route path="bag" element={<Bag />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="story" element={<Story />} />
        <Route path="care" element={<Care />} />
        <Route path="journal" element={<Journal />} />
        <Route path="journal/:slug" element={<Post />} />
        <Route path="contact" element={<Contact />} />
        <Route path="login" element={<Login />} />
        <Route path="account" element={<Guard role="customer"><Account /></Guard>} />
        <Route path="*" element={<div className="page narrow center"><p className="eyebrow">404</p><h1>This page slipped off the chain.</h1><a className="btn" href="/">Back home</a></div>} />
      </Route>
      <Route path="dashboard" element={<Guard perm="overview"><DashLayout /></Guard>}>
        <Route index element={<Overview />} />
        {dash('orders', 'orders', Orders)}
        {dash('products', 'products', Products)}
        {dash('customers', 'customers', Customers)}
        {dash('payments', 'payments', Payments)}
        {dash('inbox', 'inbox', Inbox)}
        {dash('team', 'team', Team)}
        {dash('settings', 'settings', Settings)}
      </Route>
    </Routes>
  );
}
