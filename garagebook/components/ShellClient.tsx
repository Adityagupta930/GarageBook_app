'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function ShellClient({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      {/* Overlay for mobile */}
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <Sidebar onClose={() => setOpen(false)} />
      <div className="main-area">
        <Topbar onMenuClick={() => setOpen(o => !o)} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
