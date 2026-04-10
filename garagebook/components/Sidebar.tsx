'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/hooks/useLang';

interface NavLink { href: string; icon: string; labelKey: keyof ReturnType<typeof useLang>['t']; ownerOnly: boolean; }

const links: NavLink[] = [
  { href: '/',          icon: '▦',  labelKey: 'dashboard', ownerOnly: true  },
  { href: '/inventory', icon: '📦', labelKey: 'products',  ownerOnly: false },
  { href: '/sale',      icon: '🛒', labelKey: 'newSale',   ownerOnly: false },
  { href: '/bill',      icon: '🧾', labelKey: 'bill',      ownerOnly: false },
  { href: '/bills',     icon: '📋', labelKey: 'billHistory', ownerOnly: true },
  { href: '/customers', icon: '👥', labelKey: 'customers', ownerOnly: true  },
  { href: '/credit',    icon: '💳', labelKey: 'credit',    ownerOnly: true  },
  { href: '/history',   icon: '🕓', labelKey: 'history',   ownerOnly: true  },
  { href: '/admin',     icon: '📊', labelKey: 'reports',   ownerOnly: true  },
  { href: '/eod',       icon: '📅', labelKey: 'eod',       ownerOnly: true  },
];

const shortcuts: Record<string, string> = {
  '/': 'Ctrl+D', '/sale': 'Ctrl+S', '/inventory': 'Ctrl+I',
  '/bill': 'Ctrl+B', '/history': 'Ctrl+H',
};

interface Props { onClose?: () => void; isOwner: boolean; open?: boolean; }

export default function Sidebar({ onClose, isOwner, open }: Props) {
  const path    = usePathname();
  const { t }   = useLang();
  const visible = links.filter(l => isOwner || !l.ownerOnly);

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-row">
          <div className="logo-icon">🔧</div>
          <div>
            <h1>Porwal Autoparts</h1>
            <p>Auto Parts Manager</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label" suppressHydrationWarning>Navigation</div>
        {visible.map(l => (
          <Link key={l.href} href={l.href}
            onClick={onClose}
            className={`sidebar-link ${path === l.href ? 'active' : ''}`}
            title={shortcuts[l.href] ? `Shortcut: ${shortcuts[l.href]}` : undefined}>
            <span className="icon">{l.icon}</span>
            <span style={{ flex: 1 }}>{t[l.labelKey]}</span>
            {shortcuts[l.href] && (
              <span style={{ fontSize: '9px', color: '#3d444d', fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: '4px' }}>
                {shortcuts[l.href]}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{isOwner ? 'O' : 'S'}</div>
          <div className="sidebar-user-info">
            <p>{isOwner ? t.owner : t.staff}</p>
            <span>{isOwner ? t.fullAccess : t.salesOnly}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
