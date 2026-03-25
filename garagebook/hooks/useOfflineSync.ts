'use client';
import { useEffect, useCallback, useState } from 'react';
import { toast } from '@/components/Toast';

const KEY = 'gb_offline_queue';

interface QueuedSale {
  id: string;
  payload: Record<string, unknown>;
  ts: number;
}

function getQueue(): QueuedSale[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function saveQueue(q: QueuedSale[]) {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function enqueueOfflineSale(payload: Record<string, unknown>) {
  const q = getQueue();
  q.push({ id: crypto.randomUUID(), payload, ts: Date.now() });
  saveQueue(q);
  toast('📴 Offline — sale queue mein save hua', 'info');
}

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(() => getQueue().length);

  const sync = useCallback(async () => {
    const q = getQueue();
    if (!q.length) return;
    const failed: QueuedSale[] = [];
    for (const item of q) {
      try {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });
        if (!res.ok) failed.push(item);
      } catch {
        failed.push(item);
      }
    }
    saveQueue(failed);
    setPendingCount(failed.length);
    const synced = q.length - failed.length;
    if (synced > 0) toast(`✅ ${synced} offline sale${synced > 1 ? 's' : ''} sync ho gaye!`);
  }, []);

  useEffect(() => {
    window.addEventListener('online', sync);
    if (navigator.onLine) sync();
    return () => window.removeEventListener('online', sync);
  }, [sync]);

  return { pendingCount };
}
