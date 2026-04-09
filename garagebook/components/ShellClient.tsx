'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useInactivity } from '@/hooks/useInactivity';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { toast } from '@/components/Toast';

const PUBLIC_PATHS = ['/login', '/signup'];

export default function ShellClient({ children }: { children: React.ReactNode }) {
  const [open, setOpen]   = useState(false);
  const router            = useRouter();
  const pathname          = usePathname();
  const { user, loading, signOut, isOwner } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user && !PUBLIC_PATHS.includes(pathname)) {
      router.replace('/login');
    }
  }, [user, loading, pathname, router]);

  const handleLogout = useCallback(async () => {
    await signOut();
    toast('👋 Logout ho gaye!', 'info');
    router.replace('/login');
  }, [signOut, router]);

  useKeyboardShortcuts();
  useInactivity(isOwner ? () => {} : () => {});
  useErrorLogger();
  useOfflineSync();

  // Public pages — no shell
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0d1117',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔧</div>
          <div style={{ color: '#8b949e', fontSize: '14px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Not logged in — show nothing (redirect happening)
  if (!user) return null;

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <Sidebar onClose={() => setOpen(false)} isOwner={isOwner} />
      <div className="main-area">
        <Topbar
          onMenuClick={() => setOpen(o => !o)}
          isOwner={isOwner}
          userName={user.user_metadata?.name || user.email || ''}
          onLogout={handleLogout}
        />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
