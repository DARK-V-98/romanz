import { useEffect, useState } from 'react';
import { load, cart, subscribe, expireUnpaid, courierTick } from './store.js';

// Re-reads localStorage state whenever the store changes (this tab or another).
export function useStore() {
  const [state, setState] = useState(() => ({ data: load(), bag: cart() }));
  useEffect(() => subscribe(() => setState({ data: load(), bag: cart() })), []);
  return state;
}

// Stands in for the scheduled jobs: cancel unpaid orders after the payment window, and (if switched on) the courier simulator.
export function useExpiryJob() {
  useEffect(() => { const run = () => { expireUnpaid(); courierTick(); }; run(); const t = setInterval(run, 15000); return () => clearInterval(t); }, []);
}
