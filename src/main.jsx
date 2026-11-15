import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import './style.css';
import App from './App.jsx';

class SafeShell extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('FLAME could not render this screen.', error); }
  render() {
    if (this.state.failed) return <main className="fatal-screen" dir="rtl"><section className="panel fatal-panel"><b className="brand-mark">FLAME</b><h1>تعذر عرض هذه الصفحة</h1><p>بياناتك محفوظة. يمكنك إعادة تحميل الصفحة للمحاولة من جديد.</p><button className="button primary" onClick={() => window.location.reload()}>إعادة المحاولة</button></section></main>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(<SafeShell><App /></SafeShell>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}), { once: true });
}
