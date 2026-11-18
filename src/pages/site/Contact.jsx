import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { sendMessage } from '../../lib/store.js';
import { FAQ } from '../../lib/content.js';

export default function Contact() {
  const orderId = useLocation().state?.orderId || '';
  const [form, setForm] = useState({ name: '', email: '', topic: orderId ? 'Order help' : 'General', body: '', orderId }), [msg, setMsg] = useState(null);
  const f = k => ({ value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) });
  const submit = e => { e.preventDefault(); try { sendMessage(form); setMsg(['ok', 'Thank you! Your message is in the demo inbox (staff can read it in the dashboard).']); setForm({ name: '', email: '', topic: 'General', body: '', orderId: '' }); } catch (err) { setMsg(['err', err.message]); } };
  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Contact</p><h1>We’d love to <em>hear from you.</em></h1><p className="muted">Sizing, gifting or just saying hello. We reply within a day (sample promise).</p></div>
      <div className="two-col">
        <form className="panel" onSubmit={submit}>
          <div className="fgrid">
            <label>Name<input required {...f('name')} /></label>
            <label>Email<input type="email" required {...f('email')} /></label>
            <label>Topic<select {...f('topic')}>{['General', 'Sizing', 'Gifting', 'Order help', 'Care'].map(t => <option key={t}>{t}</option>)}</select></label>
            <label>Order number (optional)<input {...f('orderId')} placeholder="RZ-…" /></label>
            <label className="span2">Message<textarea required rows="5" {...f('body')} /></label>
          </div>
          {msg && <p className={'notice ' + msg[0]} role="status">{msg[1]}</p>}
          <button className="btn">Send message</button>
        </form>
        <div>
          <h3>Questions, answered</h3>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p className="muted">{a}</p></details>)}
          <div className="panel tint-panel"><h3>Visit the studio</h3><p className="muted">42 Flower Road, Colombo 07 (sample address)<br />Tue–Sat · 10am–7pm<br />+94 11 000 0000 (sample)</p></div>
        </div>
      </div>
    </div>
  );
}
