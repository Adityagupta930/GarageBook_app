'use client';
import { useEffect, useState, useCallback } from 'react';
import StatCard from '@/components/StatCard';
import { LoadingRows, ErrorRow, EmptyRow } from '@/components/TableStates';
import { toast } from '@/components/Toast';
import { Sparkline } from '@/components/Charts';
import { fmtDate, fmtCurrency, todayStr, fuzzyMatch } from '@/lib/utils';
import { listenSync } from '@/lib/sync';
import { useRole } from '@/hooks/useRole';
import { useDailyGoal } from '@/hooks/useDailyGoal';
import type { Sale, InventoryItem } from '@/types';

type Range = 'today' | 'week' | 'month';

export default function Dashboard() {
  const [sales, setSales]     = useState<Sale[]>([]);
  const [inv, setInv]         = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [range, setRange]     = useState<Range>('today');
  const [tableSearch, setTableSearch] = useState('');
  const [goalInput, setGoalInput]     = useState('');
  const { isOwner } = useRole();
  const { goal, setGoal } = useDailyGoal();

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
    const unsync = listenSync(['sales', 'inventory'], load);
    // Auto-refresh every 5 minutes
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      unsync();
      clearInterval(timer);
    };
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
  const displayed  = tableSearch
    ? filtered.filter(s => fuzzyMatch(s.item_name + ' ' + s.customer, tableSearch))
    : filtered;
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

  // ── Data Insights ──────────────────────────────────────────────
  const topItem = (() => {
    const counts: Record<string, number> = {};
    sales.forEach(s => { counts[s.item_name] = (counts[s.item_name] || 0) + Number(s.qty); });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  })();

  const thisWeekProfit = (() => {
    const w = new Date(); w.setDate(w.getDate() - 7);
    return sales.filter(s => new Date(s.date.replace(' ', 'T')) >= w)
      .reduce((a, s) => a + ((Number(s.amount) / Number(s.qty)) - Number(s.buy_price)) * Number(s.qty), 0);
  })();
  const lastWeekProfit = (() => {
    const w1 = new Date(); w1.setDate(w1.getDate() - 14);
    const w2 = new Date(); w2.setDate(w2.getDate() - 7);
    return sales.filter(s => { const d = new Date(s.date.replace(' ', 'T')); return d >= w1 && d < w2; })
      .reduce((a, s) => a + ((Number(s.amount) / Number(s.qty)) - Number(s.buy_price)) * Number(s.qty), 0);
  })();
  const profitTrend = lastWeekProfit > 0 ? ((thisWeekProfit - lastWeekProfit) / lastWeekProfit) * 100 : 0;

  const insights: { icon: string; msg: string; color: string }[] = [];
  if (topItem) insights.push({ icon: '🔥', msg: `"${topItem}" sabse zyada bik raha hai`, color: '#ea580c' });
  if (profitTrend < -10) insights.push({ icon: '📉', msg: `Is hafte profit ${Math.abs(profitTrend).toFixed(0)}% kam hai`, color: '#dc2626' });
  if (profitTrend > 10)  insights.push({ icon: '📈', msg: `Is hafte profit ${profitTrend.toFixed(0)}% zyada hai!`, color: '#16a34a' });
  const outOfStock = inv.filter(i => Number(i.stock) === 0);
  if (outOfStock.length > 0) insights.push({ icon: '⚠️', msg: `${outOfStock.length} part${outOfStock.length > 1 ? 's' : ''} out of stock`, color: '#d97706' });
  if (credit > 5000) insights.push({ icon: '💸', msg: `₹${credit.toFixed(0)} udhaar pending — collect karo`, color: '#7c3aed' });

  const reorderItems = inv.filter(i => Number(i.stock) <= 3).sort((a, b) => Number(a.stock) - Number(b.stock));
  const goalPct   = goal > 0 ? Math.min(100, (income / goal) * 100) : 0;
  const goalColor = goalPct >= 100 ? '#16a34a' : goalPct >= 60 ? '#f97316' : '#e94560';

  // Yesterday comparison
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const key = d.toLocaleDateString('en-CA');
    return sales
      .filter(s => s.date.startsWith(key) && s.payment !== 'udhaar')
      .reduce((a, s) => a + Number(s.amount), 0);
  })();
  const vsYesterday = yesterday > 0 ? ((income - yesterday) / yesterday * 100) : null;

  function exportCSV() {
    if (!sales.length) return toast('Koi data nahi', 'info');
    const rows = [['Date', 'Part', 'Qty', 'Amount', 'Payment', 'Customer', 'Paid']];
    sales.forEach(s => rows.push([fmtDate(s.date), s.item_name, String(s.qty), String(s.amount), s.payment, s.customer, s.udhaar_paid ? 'Yes' : 'No']));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `PorwalAutoparts_${today}.csv`;
    a.click();
    toast('CSV download ho gaya!');
  }

  return (
    <div>
      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { href: '/sale',      icon: '🛒', label: 'New Sale',      bg: '#e94560' },
          { href: '/bill',      icon: '🧾', label: 'Make Bill',     bg: '#7c3aed' },
          { href: '/inventory', icon: '📦', label: 'Add Stock',     bg: '#2563eb' },
          { href: '/credit',    icon: '📋', label: 'View Credit',   bg: '#d97706' },
        ].map(a => (
          <a key={a.href} href={a.href} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '8px',
            background: a.bg + '15', color: a.bg,
            border: `1px solid ${a.bg}30`,
            fontSize: '13px', fontWeight: 600,
            textDecoration: 'none', transition: 'all .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = a.bg; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = a.bg + '15'; (e.currentTarget as HTMLElement).style.color = a.bg; }}>
            {a.icon} {a.label}
          </a>
        ))}
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Revenue" value={fmtCurrency(income)} color="green"
          sub={`${range === 'today' ? 'Today' : range === 'week' ? 'Last 7 days' : 'Last 30 days'}${
            range === 'today' && vsYesterday !== null
              ? ` · ${vsYesterday >= 0 ? '▲' : '▼'} ${Math.abs(vsYesterday).toFixed(0)}% vs kal`
              : ''
          }`}
          icon="💰"
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
          <input
            className="gb-input"
            placeholder="🔍 Part / Customer..."
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
            style={{ width: '180px', minWidth: 'unset' }}
          />
          <button className="btn-gray" onClick={load}>↻ Refresh</button>
          {isOwner && <button className="btn" onClick={exportCSV}>⬇ Export CSV</button>}
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

      {/* Data Insights Panel */}
      {!loading && insights.length > 0 && isOwner && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>🧠 Smart Insights</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {insights.map((ins, i) => (
              <span key={i} style={{
                fontSize: '12px', fontWeight: 500, padding: '4px 12px',
                borderRadius: '20px', background: ins.color + '18', color: ins.color,
                border: `1px solid ${ins.color}30`,
              }}>
                {ins.icon} {ins.msg}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Daily Goal Progress */}
      {isOwner && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>🎯 Aaj ka Target</span>
              {goal > 0 && (
                <span style={{ marginLeft: '10px', fontSize: '12px', color: goalColor, fontWeight: 700 }}>
                  {fmtCurrency(income)} / {fmtCurrency(goal)} ({goalPct.toFixed(0)}%)
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                className="gb-input"
                type="number"
                placeholder="Target ₹ set karo"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && +goalInput > 0) { setGoal(+goalInput); setGoalInput(''); } }}
                style={{ width: '150px', minWidth: 'unset', fontSize: '12px', padding: '5px 10px' }}
              />
              <button className="btn" style={{ padding: '5px 12px', fontSize: '12px' }}
                onClick={() => { if (+goalInput > 0) { setGoal(+goalInput); setGoalInput(''); } }}>
                Set
              </button>
              {goal > 0 && <button className="btn-gray" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => setGoal(0)}>✖</button>}
            </div>
          </div>
          {goal > 0 && (
            <div style={{ background: 'var(--surface2)', borderRadius: '99px', height: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{
                height: '100%', borderRadius: '99px',
                width: `${goalPct}%`,
                background: goalColor,
                transition: 'width .6s cubic-bezier(.22,1,.36,1)',
                boxShadow: goalPct >= 100 ? `0 0 8px ${goalColor}80` : 'none',
              }} />
            </div>
          )}
          {goalPct >= 100 && <p style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, marginTop: '6px' }}>🎉 Target achieve ho gaya! Badhai ho!</p>}
        </div>
      )}

      {/* Reorder Alert */}
      {isOwner && reorderItems.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid #fed7aa', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#f97316', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>📦 Reorder Karo — Stock Khatam Ho Raha Hai</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {reorderItems.map(i => (
              <span key={i.id} style={{
                fontSize: '12px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600,
                background: Number(i.stock) === 0 ? 'rgba(239,68,68,.15)' : 'rgba(249,115,22,.15)',
                color: Number(i.stock) === 0 ? '#ef4444' : '#f97316',
                border: `1px solid ${Number(i.stock) === 0 ? 'rgba(239,68,68,.3)' : 'rgba(249,115,22,.3)'}`,
              }}>
                {i.name} — {Number(i.stock) === 0 ? '❌ OUT' : `${i.stock} left`}
              </span>
            ))}
          </div>
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
             displayed.length === 0 ? <EmptyRow cols={6} msg={tableSearch ? 'Koi match nahi mila' : 'Is period mein koi sale nahi'} /> :
             displayed.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.item_name}</td>
                <td>{s.qty}</td>
                <td style={{ fontWeight: 600 }}>{fmtCurrency(Number(s.amount))}</td>
                <td><span className={`badge badge-${s.payment}`}>{s.payment === 'udhaar' ? 'Credit' : s.payment.charAt(0).toUpperCase() + s.payment.slice(1)}</span></td>
                <td style={{ color: s.customer === 'Walk-in' ? 'var(--text3)' : 'var(--text)' }}>{s.customer}</td>
                <td style={{ color: 'var(--text3)', fontSize: '12px' }}>
                  {fmtDate(s.date)}
                  {s.notes && <span style={{ display: 'block', fontSize: '11px', color: 'var(--text3)', fontStyle: 'italic' }}>{s.notes}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
