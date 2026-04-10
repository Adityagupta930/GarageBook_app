'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useInactivity } from '@/hooks/useInactivity';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { toast } from '@/components/Toast';

const PUBLIC_PATHS = ['/login', '/signup'];

const BOTTOM_NAV = [
  { href: '/',          icon: '▦',  label: 'Home'      },
  { href: '/sale',      icon: '🛒', label: 'Sale'      },
  { href: '/inventory', icon: '📦', label: 'Stock'     },
  { href: '/bill',      icon: '🧾', label: 'Bill'      },
  { href: '/credit',    icon: '💳', label: 'Credit'    },
];

export default function ShellClient({ children }: { children: React.ReactNode }) {
  const [open, setOpen]       = useState(false);
  const [desktopView, setDesktopView] = useState(false);
  const router            = useRouter();
  const pathname          = usePathname();
  const { user, loading, signOut, isOwner } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem('gb_view_mode');
    const isDesktop = saved === 'desktop';
    setDesktopView(isDesktop);
    applyViewMode(isDesktop);
  }, []);

  function applyViewMode(desktop: boolean) {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    if (desktop) {
      meta.setAttribute('content', 'width=1280');
    } else {
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0, shrink-to-fit=no, viewport-fit=cover');
    }
  }

  function toggleViewMode() {
    const next = !desktopView;
    setDesktopView(next);
    localStorage.setItem('gb_view_mode', next ? 'desktop' : 'mobile');
    applyViewMode(next);
  }

  useEffect(() => {
    if (!loading && !user && !PUBLIC_PATHS.includes(pathname)) {
      router.replace('/login');
    }
  }, [user, loading, pathname, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [pathname]);

  const handleLogout = useCallback(async () => {
    await signOut();
    toast('👋 Logout ho gaye!', 'info');
    router.replace('/login');
  }, [signOut, router]);

  useKeyboardShortcuts();
  useInactivity(isOwner ? () => {} : () => {});
  useErrorLogger();
  useOfflineSync();

  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔧</div>
          <div style={{ color: '#8b949e', fontSize: '14px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const bottomLinks = isOwner ? BOTTOM_NAV : BOTTOM_NAV.filter(l => l.href !== '/credit');

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <Sidebar onClose={() => setOpen(false)} isOwner={isOwner} open={open} desktopView={desktopView} onToggleView={toggleViewMode} />
      <div className="main-area">
        <Topbar
          onMenuClick={() => setOpen(o => !o)}
          isOwner={isOwner}
          userName={user.user_metadata?.name || user.email || ''}
          onLogout={handleLogout}
        />
        <main className="page-content">{children}</main>
      </div>

      {/* Bottom Navigation — mobile only */}
      <nav className="bottom-nav">
        {bottomLinks.map(l => (
          <Link key={l.href} href={l.href} className={`bottom-nav-item${pathname === l.href ? ' active' : ''}`}>
            <span className="bn-icon">{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
