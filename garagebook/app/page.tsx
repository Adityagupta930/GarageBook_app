'use client';
import { useEffect, useState, useCallback } from 'react';
import StatCard from '@/components/StatCard';
import { LoadingRows, ErrorRow, EmptyRow } from '@/components/TableStates';
import { toast } from '@/components/Toast';
import { fmtDate, fmtCurrency, todayStr } from '@/lib/utils';
import type { Sale, InventoryItem } from '@/types';

type Range = 'today' | 'week' | 'month';

export default function Dashboard() {
  const [sales, setSales]     = useState<Sale[]>([]);
  const [inv, setInv]         = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [range, setRange]     = useState<Range>('today');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [s, i] = await Promise.all([
        fetch('/api/sales').then(r => r.json()),
        fetch('/api/inventory').then(r => r.json()),
      ]);
      setSales(s); setInv(i);
    } catch {
      setError('Data load nahi hua. Server chal raha hai?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Refresh when user comes back to this tab
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const today = todayStr();
  const filterSales = (s: Sale) => {
    const d = new Date(s.date.replace(' ', 'T'));
    const now = new Date();
    if (range === 'today') return d.toLocaleDateString('en-CA') === today;
    if (range === 'week')  { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
    if (range === 'month') { const m = new Date(now); m.setDate(now.getDate() - 30); return d >= m; }
    return true;
  };

  const filtered = sales.filter(filterSales);
  const income   = filtered.filter(s => s.payment !== 'udhaar').reduce((a, s) => a + s.amount, 0);
  const profit   = filtered.reduce((a, s) => a + ((s.amount / s.qty) - s.buy_price) * s.qty, 0);
  const credit   = sales.filter(s => s.payment === 'udhaar' && !s.udhaar_paid).reduce((a, s) => a + s.amount, 0);
  const lowStock = inv.filter(i => i.stock <= 3).length;

  function exportCSV() {
    if (!sales.length) return toast('Koi data nahi', 'info');
    const rows = [['Date', 'Part', 'Qty', 'Amount', 'Payment', 'Customer', 'Credit Paid']];
    sales.forEach(s => rows.push([fmtDate(s.date), s.item_name, String(s.qty), String(s.amount), s.payment, s.customer, s.udhaar_paid ? 'Yes' : 'No']));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `GarageBook_${today}.csv`;
    a.click();
    toast('CSV download ho gaya!');
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label={`${range === 'today' ? 'Aaj ki' : range === 'week' ? 'Week ki' : 'Month ki'} Kamai`} value={fmtCurrency(income)} color="green" />
        <StatCard label="Net Profit" value={fmtCurrency(profit)} color="blue" />
        <StatCard label="Credit Pending" value={fmtCurrency(credit)} color="orange" />
        <StatCard label="Low Stock Parts" value={lowStock} color="red" />
      </div>

      <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
        <div className="flex gap-1">
          {(['today', 'week', 'month'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${range === r ? 'bg-[#1a1a2e] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
              {r === 'today' ? 'Aaj' : r === 'week' ? '7 Din' : '30 Din'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn-gray text-sm px-3 py-1.5 rounded-lg" onClick={load}>🔄 Refresh</button>
          <button className="btn text-sm" onClick={exportCSV}>⬇️ Export CSV</button>
        </div>
      </div>

      <table className="gb-table">
        <thead><tr><th>Part</th><th>Qty</th><th>Amount</th><th>Payment</th><th>Customer</th><th>Date</th></tr></thead>
        <tbody>
          {loading ? <LoadingRows cols={6} /> :
           error   ? <ErrorRow cols={6} msg={error} /> :
           filtered.length === 0 ? <EmptyRow cols={6} msg="Is period mein koi sale nahi" /> :
           filtered.map(s => (
            <tr key={s.id}>
              <td>{s.item_name}</td>
              <td>{s.qty}</td>
              <td>{fmtCurrency(s.amount)}</td>
              <td><span className={`badge badge-${s.payment}`}>{s.payment.toUpperCase()}</span></td>
              <td>{s.customer}</td>
              <td className="text-gray-400 text-xs">{fmtDate(s.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
