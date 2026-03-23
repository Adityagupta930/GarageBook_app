'use client';
import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';
const TOAST_EVENT = 'gb:toast';

export function toast(msg: string, type: ToastType = 'success') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { msg, type } }));
}

const colors: Record<ToastType, string> = {
  success: '#16a34a',
  error:   '#dc2626',
  info:    '#2563eb',
};

interface ToastItem { id: number; msg: string; type: ToastType; }

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { msg, type } = (e as CustomEvent).detail;
      const id = Date.now();
      setToasts(p => [...p, { id, msg, type }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className="toast-item animate-slide-in"
          style={{ background: colors[t.type] }}>
          {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✕ ' : 'ℹ '}{t.msg}
        </div>
      ))}
    </div>
  );
}
