'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const titles: Record<string, string> = {
  '/':          'Dashboard',
  '/inventory': 'Products',
  '/sale':      'New Sale',
  '/bill':      'Bill',
  '/credit':    'Credit Book',
  '/history':   'Sales History',
  '/admin':     'Reports & Admin',
};

interface Props { onMenuClick: () => void; }

export default function Topbar({ onMenuClick }: Props) {
  const path = usePathname();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('gb_theme');
    if (saved === 'dark') { document.documentElement.classList.add('dark'); setDark(true); }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('gb_theme', next ? 'dark' : 'light');
  }

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="hamburger" onClick={onMenuClick} aria-label="Menu">☰</button>
        <span className="topbar-title">{titles[path] ?? 'GarageBook'}</span>
      </div>
      <div className="topbar-right">
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle dark mode">
          {dark ? '☀️' : '🌙'}
        </button>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 700 }}>
          A
        </div>
      </div>
    </header>
  );
}
