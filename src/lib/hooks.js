import { useEffect, useState } from 'react';
import { load, cart, subscribe } from './store.js';

// Re-reads localStorage state whenever the store changes (this tab or another).
export function useStore() {
  const [state, setState] = useState(() => ({ data: load(), bag: cart() }));
  useEffect(() => subscribe(() => setState({ data: load(), bag: cart() })), []);
  return state;
}
