import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, USERS, ROLES, homeFor } from '../../lib/auth.jsx';

export default function Login() {
  const { user, login, logout } = useAuth(), nav = useNavigate(), from = useLocation().state?.from;
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState('');
  const go = (e, pw) => {
    try { const u = login(e, pw); nav(from && from !== '/login' ? from : homeFor(u), { replace: true }); } catch (err) { setError(err.message); }
  };
  if (user) return (
    <div className="page narrow center">
      <p className="eyebrow">Signed in</p><h1>Hello, <em>{user.name.split(' ')[0]}.</em></h1>
      <p className="muted">{ROLES[user.role].label}</p>
      <div className="row center-row"><Link to={homeFor(user)} className="btn">Go to {user.role === 'customer' ? 'my account' : 'dashboard'}</Link><button className="btn ghost" onClick={logout}>Sign out</button></div>
    </div>
  );
  return (
    <div className="page login">
      <form className="panel" onSubmit={e => { e.preventDefault(); go(email, password); }}>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign <em>in.</em></h1>
        <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" /></label>
        <label>Password<input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {error && <p className="notice err" role="alert">{error}</p>}
        <button className="btn block">Sign in</button>
        <p className="muted small">Mock login: credentials are checked in your browser only.</p>
      </form>
      <div>
        <h3>Demo accounts</h3>
        <p className="muted small">Each role sees a different part of the app. Click one to sign in instantly.</p>
        <div className="demo-list">
          {USERS.map(u => (
            <button key={u.id} type="button" className="demo-acct" onClick={() => go(u.email, u.password)}>
              <span className={'avatar r-' + u.role}>{u.name[0]}</span>
              <span className="grow"><b>{ROLES[u.role].label}</b><small>{u.email} · {u.password}</small></span>
              <span className="muted small">{u.role === 'customer' ? 'Account' : ROLES[u.role].can.length + ' areas'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
