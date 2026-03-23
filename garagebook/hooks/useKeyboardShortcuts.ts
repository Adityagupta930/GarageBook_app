'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      // Don't fire when typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      switch (e.key.toLowerCase()) {
        case 's': e.preventDefault(); router.push('/sale'); break;
        case 'i': e.preventDefault(); router.push('/inventory'); break;
        case 'b': e.preventDefault(); router.push('/bill'); break;
        case 'h': e.preventDefault(); router.push('/history'); break;
        case 'd': e.preventDefault(); router.push('/'); break;
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);
}
