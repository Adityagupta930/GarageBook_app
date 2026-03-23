'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/',          icon: '▦',  label: 'Dashboard' },
  { href: '/inventory', icon: '📦', label: 'Products' },
  { href: '/sale',      icon: '🛒', label: 'New Sale' },
  { href: '/bill',      icon: '🧾', label: 'Bill' },
  { href: '/credit',    icon: '📋', label: 'Credit' },
  { href: '/history',   icon: '🕓', label: 'History' },
  { href: '/admin',     icon: '📊', label: 'Reports' },
];

interface Props { onClose?: () => void; }

export default function Sidebar({ onClose }: Props) {
  const path = usePathname();
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-row">
          <div className="logo-icon">🔧</div>
          <div>
            <h1>GarageBook</h1>
            <p>Auto Parts Manager</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Menu</div>
        {links.map(l => (
          <Link key={l.href} href={l.href}
            onClick={onClose}
            className={`sidebar-link ${path === l.href ? 'active' : ''}`}>
            <span className="icon">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">A</div>
          <div className="sidebar-user-info">
            <p>Admin</p>
            <span>Shop Owner</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
