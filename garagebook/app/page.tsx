'use client';
import { useEffect, useState, useCallback } from 'react';
import StatCard from '@/components/StatCard';
import { LoadingRows, ErrorRow, EmptyRow } from '@/components/TableStates';
import { toast } from '@/components/Toast';
import { Sparkline } from '@/components/Charts';
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
      setSales(Array.isArray(s) ? s : []);
      setInv(Array.isArray(i) ? i : []);
    } catch {
      setError('Data load nahi hua.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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

  const filtered  = sales.filter(filterSales);
  const income    = filtered.filter(s => s.payment !== 'udhaar').reduce((a, s) => a + Number(s.amount), 0);
  const profit    = filtered.reduce((a, s) => a + ((Number(s.amount) / Number(s.qty)) - Number(s.buy_price)) * Number(s.qty), 0);
  const credit    = sales.filter(s => s.payment === 'udhaar' && !s.udhaar_paid).reduce((a, s) => a + Number(s.amount), 0);
  const lowStock  = inv.filter(i => Number(i.stock) > 0 && Number(i.stock) <= 3).length;
  const outStock  = inv.filter(i => Number(i.stock) === 0).length;

  // Last 7 days sparkline data
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toLocaleDateString('en-CA');
    return sales.filter(s => s.date.startsWith(key) && s.payment !== 'udhaar').reduce((a, s) => a + Number(s.amount), 0);
  });

  function exportCSV() {
    if (!sales.length) return toast('Koi data nahi', 'info');
    const rows = [['Date', 'Part', 'Qty', 'Amount', 'Payment', 'Customer', 'Paid']];
    sales.forEach(s => rows.push([fmtDate(s.date), s.item_name, String(s.qty), String(s.amount), s.payment, s.customer, s.udhaar_paid ? 'Yes' : 'No']));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `GarageBook_${today}.csv`;
    a.click();
    toast('CSV download ho gaya!');
  }

  return (
    <div>
      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Revenue" value={fmtCurrency(income)} color="green" sub={range === 'today' ? 'Today' : range === 'week' ? 'Last 7 days' : 'Last 30 days'} icon="💰"
          sparkline={<Sparkline data={last7} color="#22c55e" />} />
        <StatCard label="Net Profit" value={fmtCurrency(profit)} color="blue" sub="After cost price" icon="📈"
          sparkline={<Sparkline data={last7.map(v => v * 0.3)} color="#3b82f6" />} />
        <StatCard label="Credit Pending" value={fmtCurrency(credit)} color="orange" sub="Unpaid udhaar" icon="📋" />
        <StatCard label="Low Stock" value={lowStock} color="red" sub={outStock > 0 ? `${outStock} out of stock` : 'Items ≤ 3'} icon="⚠️" />
        <StatCard label="Total Sales" value={filtered.length} color="purple" sub="Transactions" icon="🛒" />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px' }}>
          {(['today', 'week', 'month'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', background: range === r ? 'var(--primary)' : 'transparent', color: range === r ? '#fff' : 'var(--text2)', transition: 'all .15s' }}>
              {r === 'today' ? 'Today' : r === 'week' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-gray" onClick={load}>↻ Refresh</button>
          <button className="btn" onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Summary strip */}
      {!loading && filtered.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text2)' }}>📦 <b style={{ color: 'var(--text)' }}>{filtered.length}</b> sales</span>
          <span style={{ color: 'var(--text2)' }}>💵 Cash: <b style={{ color: '#16a34a' }}>{fmtCurrency(filtered.filter(s => s.payment === 'cash').reduce((a, s) => a + Number(s.amount), 0))}</b></span>
          <span style={{ color: 'var(--text2)' }}>📱 Online: <b style={{ color: '#2563eb' }}>{fmtCurrency(filtered.filter(s => s.payment === 'online').reduce((a, s) => a + Number(s.amount), 0))}</b></span>
          <span style={{ color: 'var(--text2)' }}>📋 Credit: <b style={{ color: '#ea580c' }}>{fmtCurrency(filtered.filter(s => s.payment === 'udhaar').reduce((a, s) => a + Number(s.amount), 0))}</b></span>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="gb-table">
          <thead>
            <tr><th>Part</th><th>Qty</th><th>Amount</th><th>Payment</th><th>Customer</th><th>Date</th></tr>
          </thead>
          <tbody>
            {loading ? <LoadingRows cols={6} /> :
             error   ? <ErrorRow cols={6} msg={error} /> :
             filtered.length === 0 ? <EmptyRow cols={6} msg="Is period mein koi sale nahi" /> :
             filtered.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.item_name}</td>
                <td>{s.qty}</td>
                <td style={{ fontWeight: 600 }}>{fmtCurrency(Number(s.amount))}</td>
                <td><span className={`badge badge-${s.payment}`}>{s.payment === 'udhaar' ? 'Credit' : s.payment.charAt(0).toUpperCase() + s.payment.slice(1)}</span></td>
                <td style={{ color: s.customer === 'Walk-in' ? 'var(--text3)' : 'var(--text)' }}>{s.customer}</td>
                <td style={{ color: 'var(--text3)', fontSize: '12px' }}>{fmtDate(s.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
