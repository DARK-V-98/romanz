/* Mock role-based login. Passwords are public demo values checked in the browser: not real authentication. */
import { createContext, useContext, useState } from 'react';

export const ROLES = {
  admin: { label: 'Administrator', can: ['overview', 'orders', 'products', 'customers', 'payments', 'inbox', 'team', 'settings'] },
  manager: { label: 'Store manager', can: ['overview', 'orders', 'products', 'customers', 'payments', 'inbox'] },
  staff: { label: 'Fulfilment staff', can: ['overview', 'orders', 'inbox'] },
  customer: { label: 'Customer', can: [] }
};

export const USERS = [
  { id: 'u1', name: 'Romana Perera', email: 'admin@romanz.lk', password: 'admin123', role: 'admin', title: 'Founder & creative director' },
  { id: 'u2', name: 'Chamari Weerasinghe', email: 'manager@romanz.lk', password: 'manager123', role: 'manager', title: 'Store manager' },
  { id: 'u3', name: 'Lahiru Dissanayake', email: 'staff@romanz.lk', password: 'staff123', role: 'staff', title: 'Packing & dispatch' },
  { id: 'u4', name: 'Demo Customer', email: 'customer@romanz.lk', password: 'customer123', role: 'customer', title: 'ROMANZ Circle member' }
];

const KEY = 'romanz-session';
const Ctx = createContext(null);
const find = id => USERS.find(u => u.id === id) || null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return find(localStorage.getItem(KEY)); } catch { return null; } });
  const login = (email, password) => {
    const u = USERS.find(u => u.email === email.trim().toLowerCase() && u.password === password);
    if (!u) throw Error('Email or password is incorrect. Try one of the demo accounts.');
    localStorage.setItem(KEY, u.id); setUser(u); return u;
  };
  const logout = () => { localStorage.removeItem(KEY); setUser(null); };
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const can = (user, perm) => !!user && ROLES[user.role].can.includes(perm);
export const homeFor = user => user.role === 'customer' ? '/account' : '/dashboard';
