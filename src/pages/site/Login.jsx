import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, USERS, ROLES, homeFor } from '../../lib/auth.jsx';
import { requestReset, resetPassword } from '../../lib/store.js';

export default function Login() {
  const { user, login, register, logout } = useAuth(), nav = useNavigate(), loc = useLocation(), [params] = useSearchParams();
  const from = loc.state?.from;
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ name: loc.state?.name || '', email: loc.state?.email || '', password: '', phone: '', code: '' });
  const [error, setError] = useState(''), [info, setInfo] = useState('');
  const f = k => ({ value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) });
  const go = u => nav(from && from !== '/login' ? from : homeFor(u), { replace: true });
  const run = fn => e => { e?.preventDefault(); setError(''); setInfo(''); try { fn(); } catch (err) { setError(err.message); } };
  const switchTo = m => { setMode(m); setError(''); setInfo(''); };

  if (user) return (
    <div className="page narrow center">
      <p className="eyebrow">Signed in</p><h1>Hello, <em>{user.name.split(' ')[0]}.</em></h1>
      <p className="muted">{ROLES[user.role].label}</p>
      <div className="row center-row"><Link to={homeFor(user)} className="btn">Go to {user.role === 'customer' ? 'my account' : 'dashboard'}</Link><button className="btn ghost" onClick={logout}>Sign out</button></div>
    </div>
  );
  return (
    <div className="page login">
      {mode === 'login' && <form className="panel" onSubmit={run(() => go(login(form.email, form.password)))}>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign <em>in.</em></h1>
        <label>Email<input type="email" required {...f('email')} autoComplete="username" /></label>
        <label>Password<input type="password" required {...f('password')} autoComplete="current-password" /></label>
        {error && <p className="notice err" role="alert">{error}</p>}
        <button className="btn block">Sign in</button>
        <div className="row spread"><button type="button" className="link" onClick={() => switchTo('register')}>Create an account</button><button type="button" className="link" onClick={() => switchTo('forgot')}>Forgot password?</button></div>
        <p className="muted small">Mock login: credentials are checked in your browser only.</p>
      </form>}
      {mode === 'register' && <form className="panel" onSubmit={run(() => go(register(form)))}>
        <p className="eyebrow">Join the ROMANZ Circle</p>
        <h1>Create an <em>account.</em></h1>
        <label>Full name<input required {...f('name')} autoComplete="name" /></label>
        <label>Email<input type="email" required {...f('email')} autoComplete="email" /></label>
        <label>Phone (optional)<input {...f('phone')} autoComplete="tel" /></label>
        <label>Password<input type="password" required minLength="8" {...f('password')} autoComplete="new-password" /></label>
        {error && <p className="notice err" role="alert">{error}</p>}
        <button className="btn block">Create account</button>
        <p className="muted small">Earlier orders placed with this email are linked to your account automatically. <button type="button" className="link" onClick={() => switchTo('login')}>I already have an account</button></p>
      </form>}
      {mode === 'forgot' && <form className="panel" onSubmit={run(() => { if (!form.code) { requestReset(form.email); setInfo('If that email has an account, a 6-digit code is on its way. In this demo, staff can see it under Studio → Outbox.'); } else { resetPassword(form.email, form.code, form.password); setMode('login'); setForm({ ...form, password: '', code: '' }); setInfo('Password changed. Sign in with your new password.'); } })}>
        <p className="eyebrow">Reset password</p>
        <h1>Forgot your <em>password?</em></h1>
        <label>Email<input type="email" required {...f('email')} /></label>
        <label>Code from the email<input {...f('code')} inputMode="numeric" placeholder="Leave empty to send a code" /></label>
        {form.code && <label>New password<input type="password" required minLength="8" {...f('password')} autoComplete="new-password" /></label>}
        {error && <p className="notice err" role="alert">{error}</p>}
        {info && <p className="notice ok">{info}</p>}
        <button className="btn block">{form.code ? 'Set new password' : 'Send reset code'}</button>
        <button type="button" className="link" onClick={() => switchTo('login')}>Back to sign in</button>
      </form>}
      <div>
        {info && mode === 'login' && <p className="notice ok">{info}</p>}
        <h3>Demo accounts</h3>
        <p className="muted small">Each role sees a different part of the app. Click one to sign in instantly.</p>
        <div className="demo-list">
          {USERS.map(u => (
            <button key={u.id} type="button" className="demo-acct" onClick={run(() => go(login(u.email, u.password)))}>
              <span className={'avatar r-' + u.role}>{u.name[0]}</span>
              <span className="grow"><b>{ROLES[u.role].label}</b><small>{u.email} · {u.password}</small></span>
              <span className="muted small">{u.role === 'customer' ? 'Account' : ROLES[u.role].can.length + ' areas'}</span>
            </button>
          ))}
        </div>
        <p className="muted small">Want to try the team tools? Sign in as admin, invite someone in Team & roles, then sign in with the temporary password from the Outbox.</p>
      </div>
    </div>
  );
}
