'use client';
import { useEffect, useRef } from 'react';
import { toast } from '@/components/Toast';

const WARN_MS  = 25 * 60 * 1000; // 25 min
const LIMIT_MS = 30 * 60 * 1000; // 30 min

export function useInactivity(onLogout: () => void) {
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function reset() {
      clearTimeout(warnTimer.current);
      clearTimeout(logoutTimer.current);
      warnTimer.current  = setTimeout(() => toast('⚠️ 5 min mein session expire hoga!', 'info'), WARN_MS);
      logoutTimer.current = setTimeout(onLogout, LIMIT_MS);
    }

    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      clearTimeout(warnTimer.current);
      clearTimeout(logoutTimer.current);
    };
  }, [onLogout]);
}
