import { useEffect, useState } from 'react';
import { load, cart, subscribe, expireUnpaid } from './store.js';

// Re-reads localStorage state whenever the store changes (this tab or another).
export function useStore() {
  const [state, setState] = useState(() => ({ data: load(), bag: cart() }));
  useEffect(() => subscribe(() => setState({ data: load(), bag: cart() })), []);
  return state;
}

// Stands in for the scheduled job that cancels unpaid orders after the payment window.
export function useExpiryJob() {
  useEffect(() => { expireUnpaid(); const t = setInterval(() => expireUnpaid(), 30000); return () => clearInterval(t); }, []);
}
