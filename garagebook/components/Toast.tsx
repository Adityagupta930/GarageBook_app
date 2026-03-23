'use client';
import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

const TOAST_EVENT = 'gb:toast';

export function toast(msg: string, type: ToastType = 'success') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { msg, type } }));
}

const colors: Record<ToastType, string> = {
  success: 'bg-green-600',
  error:   'bg-red-500',
  info:    'bg-blue-600',
};

interface ToastItem { id: number; msg: string; type: ToastType; }

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { msg, type } = (e as CustomEvent).detail;
      const id = Date.now();
      setToasts(p => [...p, { id, msg, type }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`${colors[t.type]} text-white px-4 py-2.5 rounded-lg shadow-lg text-sm animate-slide-in max-w-xs`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
