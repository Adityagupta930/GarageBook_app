'use client';
import { useEffect, useState, useCallback } from 'react';
import { LoadingRows, ErrorRow, EmptyRow } from '@/components/TableStates';
import { toast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import { fmtDate, fmtCurrency } from '@/lib/utils';
import { listenSync, broadcast } from '@/lib/sync';
import type { Sale } from '@/types';

export default function HistoryPage() {
  const [sales, setSales]     = useState<Sale[]>([]);
  const [date, setDate]       = useState('');
  const [payment, setPayment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (date)    { params.set('from', date); params.set('to', date); }
      if (payment) params.set('payment', payment);
      setSales(await fetch(`/api/sales?${params}`).then(r => r.json()));
    } catch {
      setError('History load nahi hui.');
    } finally {
      setLoading(false);
    }
  }, [date, payment]);

  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    const unsync = listenSync(['sales'], load);
    return () => { document.removeEventListener('visibilitychange', onVisible); unsync(); };
  }, [load]);

  async function deleteSale(id: number) {
    setConfirmId(id);
  }

  async function doDelete(id: number) {
    const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    if (!res.ok) return toast('Delete nahi hua', 'error');
    toast('Sale deleted', 'info');
    broadcast('sales');
    setConfirmId(null);
    await load();
  }

  const total = sales.reduce((a, s) => a + s.amount, 0);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input type="date" className="gb-input max-w-xs" value={date} onChange={e => setDate(e.target.value)} />
        <select className="gb-input max-w-xs" value={payment} onChange={e => setPayment(e.target.value)}>
          <option value="">All Payments</option>
          <option value="cash">💵 Cash</option>
          <option value="online">📱 Online</option>
          <option value="udhaar">📋 Credit</option>
        </select>
        <button className="btn-gray text-sm px-3 py-2 rounded-lg"
          onClick={() => { setDate(''); setPayment(''); }}>✖ Clear</button>
        {!loading && sales.length > 0 && (
          <span className="text-sm text-gray-600 ml-auto">
            {sales.length} records — <span className="font-bold text-green-700">{fmtCurrency(total)}</span>
          </span>
        )}
      </div>

      <table className="gb-table">
        <thead><tr><th>Date</th><th>Part</th><th>Qty</th><th>Amount</th><th>Payment</th><th>Customer</th><th></th></tr></thead>
        <tbody>
          {loading ? <LoadingRows cols={7} /> :
           error   ? <ErrorRow cols={7} msg={error} /> :
           sales.length === 0 ? <EmptyRow cols={7} msg="Koi record nahi mila" /> :
           sales.map(s => (
            <tr key={s.id}>
              <td className="text-xs text-gray-500">{fmtDate(s.date)}</td>
              <td>{s.item_name}</td>
              <td>{s.qty}</td>
              <td>{fmtCurrency(s.amount)}</td>
              <td><span className={`badge badge-${s.payment}`}>{s.payment.toUpperCase()}</span></td>
              <td>{s.customer}</td>
              <td>
                <button className="btn-sm bg-red-500 text-white" onClick={() => deleteSale(s.id)}>🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmId !== null && (
        <ConfirmModal
          message="Ye sale permanently delete karo?"
          onConfirm={() => doDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
