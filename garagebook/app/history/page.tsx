'use client';
import { useEffect, useState, useCallback } from 'react';
import { fmtDate, fmtCurrency } from '@/lib/utils';
import type { Sale } from '@/types';

export default function HistoryPage() {
  const [sales, setSales]   = useState<Sale[]>([]);
  const [date, setDate]     = useState('');
  const [payment, setPayment] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (date)    params.set('from', date);
    if (date)    params.set('to', date);
    if (payment) params.set('payment', payment);
    const data = await fetch(`/api/sales?${params}`).then(r => r.json());
    setSales(data); setLoading(false);
  }, [date, payment]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="date" className="gb-input max-w-xs" value={date} onChange={e => setDate(e.target.value)} />
        <select className="gb-input max-w-xs" value={payment} onChange={e => setPayment(e.target.value)}>
          <option value="">All Payments</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
          <option value="udhaar">Credit</option>
        </select>
        <button className="btn-gray" onClick={() => { setDate(''); setPayment(''); }}>✖ Clear</button>
      </div>

      <table className="gb-table">
        <thead><tr><th>Date</th><th>Part</th><th>Qty</th><th>Amount</th><th>Payment</th><th>Customer</th></tr></thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="text-center text-gray-400 py-5">Loading...</td></tr>
          ) : sales.length === 0 ? (
            <tr><td colSpan={6} className="text-center text-gray-400 py-5">Koi record nahi mila</td></tr>
          ) : sales.map(s => (
            <tr key={s.id}>
              <td>{fmtDate(s.date)}</td>
              <td>{s.item_name}</td>
              <td>{s.qty}</td>
              <td>{fmtCurrency(s.amount)}</td>
              <td><span className={`badge badge-${s.payment}`}>{s.payment.toUpperCase()}</span></td>
              <td>{s.customer}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
