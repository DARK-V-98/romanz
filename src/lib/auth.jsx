/* Mock login backed by the users table in the local store. Passwords are demo values checked in the browser: not real authentication. */
import { createContext, useContext, useEffect, useState } from 'react';
import { authenticate, register as registerUser, load, subscribe, mergeGuestWishlist, DEMO_USERS } from './store.js';

export const ROLES = {
  admin: { label: 'Administrator', can: ['overview', 'orders', 'products', 'customers', 'payments', 'inbox', 'team', 'settings'] },
  manager: { label: 'Store manager', can: ['overview', 'orders', 'products', 'customers', 'payments', 'inbox'] },
  staff: { label: 'Fulfilment staff', can: ['overview', 'orders', 'inbox'] },
  customer: { label: 'Customer', can: [] }
};
export const USERS = DEMO_USERS;

const KEY = 'romanz-session';
const Ctx = createContext(null);
const find = id => { const u = id && load().users.find(u => u.id === id); return u && u.active ? u : null; };

export function AuthProvider({ children }) {
  const [id, setId] = useState(() => { try { return localStorage.getItem(KEY); } catch { return null; } });
  const [user, setUser] = useState(() => find(id));
  // Re-read the account whenever the store changes, so role changes and deactivation apply immediately.
  useEffect(() => { setUser(find(id)); return subscribe(() => setUser(find(id))); }, [id]);
  const start = u => { localStorage.setItem(KEY, u.id); mergeGuestWishlist(u.id); setId(u.id); setUser(u); return u; };
  const login = (email, password) => start(authenticate(email, password));
  const register = input => start(registerUser(input));
  const logout = () => { localStorage.removeItem(KEY); setId(null); setUser(null); };
  return <Ctx.Provider value={{ user, login, register, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const can = (user, perm) => !!user && ROLES[user.role].can.includes(perm);
export const homeFor = user => user.role === 'customer' ? '/account' : '/dashboard';
export const actorOf = user => user ? { id: user.id, name: user.name, role: user.role } : undefined;
