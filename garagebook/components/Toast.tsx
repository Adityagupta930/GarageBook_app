'use client';
import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastMsg { id: number; msg: string; type: ToastType; }

const colors: Record<ToastType, string> = {
  success: 'bg-green-600',
  error:   'bg-red-600',
  info:    'bg-blue-600',
};

let _push: ((msg: string, type?: ToastType) => void) | null = null;
export const toast = (msg: string, type: ToastType = 'success') => _push?.(msg, type);

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => {
    _push = (msg, type = 'success') => {
      const id = Date.now();
      setToasts(p => [...p, { id, msg, type }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };
    return () => { _push = null; };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`${colors[t.type]} text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-slide-in`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
