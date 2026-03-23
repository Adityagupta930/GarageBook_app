'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const links = [
  { href: '/',          label: '🏠 Dashboard' },
  { href: '/inventory', label: '📦 Parts' },
  { href: '/sale',      label: '🛒 New Sale' },
  { href: '/credit',    label: '📋 Credit' },
  { href: '/history',   label: '🕓 History' },
  { href: '/bill',      label: '🧾 Bill' },
  { href: '/admin',     label: '⚙️ Admin' },
];

export default function Navbar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-[#1a1a2e] text-white px-5 py-3 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">🔧 GarageBook</h1>
        <button className="md:hidden text-gray-300 hover:text-white text-xl px-1"
          onClick={() => setOpen(o => !o)} aria-label="Menu">
          {open ? '✕' : '☰'}
        </button>
      </div>
      <nav className={`flex flex-wrap gap-1 mt-2 ${open ? 'flex' : 'hidden md:flex'}`}>
        {links.map(l => (
          <Link key={l.href} href={l.href}
            onClick={() => setOpen(false)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              path === l.href ? 'bg-[#e94560] text-white' : 'text-gray-400 hover:bg-[#e94560] hover:text-white'
            }`}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
