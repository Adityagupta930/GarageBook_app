'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/',          label: '🏠 Dashboard' },
  { href: '/inventory', label: '📦 Parts' },
  { href: '/sale',      label: '🛒 New Sale' },
  { href: '/credit',    label: '📋 Credit' },
  { href: '/history',   label: '🕓 History' },
  { href: '/admin',     label: '⚙️ Admin' },
  { href: '/bill',      label: '🧾 Bill' },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <header className="bg-[#1a1a2e] text-white px-5 py-3 sticky top-0 z-40">
      <h1 className="text-lg font-bold mb-2">🔧 GarageBook</h1>
      <nav className="flex flex-wrap gap-1">
        {links.map(l => (
          <Link key={l.href} href={l.href}
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
