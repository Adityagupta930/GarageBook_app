'use client';
import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/components/Toast';
import { LoadingRows, ErrorRow, EmptyRow } from '@/components/TableStates';
import { fmtDate, fmtCurrency, fuzzyMatch } from '@/lib/utils';
import type { Customer, Return, ReportSummary, DailyReport, TopPart, Sale, Bill, BillWithItems } from '@/types';
import { DailyBarChart, TopPartsChart } from '@/components/Charts';
import ConfirmModal from '@/components/ConfirmModal';
import { useAuth } from '@/hooks/useAuth';
import { broadcast } from '@/lib/sync';
import { getErrorLog, clearErrorLog } from '@/hooks/useErrorLogger';

type Tab = 'reports' | 'customers' | 'returns' | 'sales' | 'bills' | 'errorlog';



export default function AdminPage() {
  const [tab, setTab]             = useState<Tab>('reports');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [returns, setReturns]     = useState<Return[]>([]);
  const [summary, setSummary]     = useState<ReportSummary | null>(null);
  const [daily, setDaily]         = useState<DailyReport[]>([]);
  const [topParts, setTopParts]   = useState<TopPart[]>([]);
  const [cLoading, setCLoading]   = useState(false);
  const [rLoading, setRLoading]   = useState(false);
  const [sLoading, setSLoading]   = useState(false);
  const [cForm, setCForm]         = useState({ name: '', phone: '', address: '' });
  const [rForm, setRForm]         = useState({ item_name: '', qty: '', amount: '', reason: '' });
  const [confirmCust, setConfirmCust] = useState<{ id: number; name: string } | null>(null);
  const [sales, setSales]             = useState<Sale[]>([]);
  const [saleSearch, setSaleSearch]   = useState('');
  const [salLoading, setSalLoading]   = useState(false);
  const [editSale, setEditSale]       = useState<Sale | null>(null);
  const [editForm, setEditForm]       = useState<{ item_name: string; qty: string; amount: string; payment: string; customer: string; phone: string; date: string } | null>(null);
  const [confirmSaleId, setConfirmSaleId] = useState<number | null>(null);
  const [eSaving, setESaving]         = useState(false);
  const [bills, setBills]             = useState<Bill[]>([]);
  const [billDetail, setBillDetail]   = useState<BillWithItems | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [confirmBillId, setConfirmBillId] = useState<number | null>(null);
  const { isOwner } = useRole();
  const [errorLog, setErrorLog] = useState(() => getErrorLog());

  const loadCustomers = useCallback(async () => {
    setCLoading(true);
    try {
      const d = await fetch('/api/customers').then(r => r.json());
      setCustomers(Array.isArray(d) ? d : []);
    } finally { setCLoading(false); }
  }, []);

  const loadReturns = useCallback(async () => {
    setRLoading(true);
    try {
      const d = await fetch('/api/returns').then(r => r.json());
      setReturns(Array.isArray(d) ? d : []);
    } finally { setRLoading(false); }
  }, []);

  const loadReports = useCallback(async () => {
    setSLoading(true);
    try {
      const [s, d, t] = await Promise.all([
        fetch('/api/reports?type=summary').then(r => r.json()),
        fetch('/api/reports?type=daily').then(r => r.json()),
        fetch('/api/reports?type=topparts').then(r => r.json()),
      ]);
      setSummary(s);
      setDaily(Array.isArray(d) ? d.slice(0, 30) : []);
      setTopParts(Array.isArray(t) ? t : []);
    } finally { setSLoading(false); }
  }, []);

  const loadSales = useCallback(async () => {
    setSalLoading(true);
    try {
      const d = await fetch('/api/sales').then(r => r.json());
      setSales(Array.isArray(d) ? d : []);
    } finally { setSalLoading(false); }
  }, []);

  const loadBills = useCallback(async () => {
    setBillLoading(true);
    try {
      const d = await fetch('/api/bills').then(r => r.json());
      setBills(Array.isArray(d) ? d : []);
    } finally { setBillLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'customers') loadCustomers();
    if (tab === 'returns')   loadReturns();
    if (tab === 'reports')   loadReports();
    if (tab === 'sales')     loadSales();
    if (tab === 'bills')     loadBills();
  }, [tab, loadCustomers, loadReturns, loadReports, loadSales, loadBills]);

  function openEditSale(s: Sale) {
    setEditSale(s);
    setEditForm({ item_name: s.item_name, qty: String(s.qty), amount: String(s.amount), payment: s.payment, customer: s.customer, phone: s.phone || '', date: s.date.slice(0, 16) });
  }

  async function saveEditSale() {
    if (!editSale || !editForm) return;
    if (!editForm.item_name.trim()) return toast('Item naam zaroori!', 'error');
    if (editForm.payment === 'udhaar' && !editForm.customer.trim()) return toast('Customer naam zaroori!', 'error');
    setESaving(true);
    try {
      const res = await fetch(`/api/sales/${editSale.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: editForm.item_name.trim(), qty: +editForm.qty, amount: +editForm.amount, payment: editForm.payment, customer: editForm.customer.trim() || 'Walk-in', phone: editForm.phone.trim(), date: editForm.date.replace('T', ' ') + ':00' }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error || 'Update nahi hua', 'error');
      toast('✅ Sale updated!'); broadcast('sales');
      setEditSale(null); setEditForm(null); await loadSales();
    } finally { setESaving(false); }
  }

  async function doDeleteSale(id: number) {
    const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    if (!res.ok) return toast('Delete nahi hua', 'error');
    toast('Sale deleted', 'info'); broadcast('sales');
    setConfirmSaleId(null); await loadSales();
  }

  async function doDeleteBill(id: number) {
    const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
    if (!res.ok) return toast('Bill delete nahi hua', 'error');
    toast('Bill deleted', 'info');
    setConfirmBillId(null);
    setBillDetail(null);
    await loadBills();
  }

  async function openBillDetail(id: number) {
    const res = await fetch(`/api/bills/${id}`);
    const data = await res.json();
    if (!res.ok) return toast('Bill load nahi hua', 'error');
    setBillDetail(data);
  }

  function reprintBill(b: BillWithItems) {
    const win = window.open('', '_blank');
    if (!win) return;
    const payLabel = b.payment === 'cash' ? 'Cash 💵' : b.payment === 'online' ? 'Online 📱' : 'Credit / Udhaar 📋';
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Bill #${b.bill_no}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f6fb;display:flex;justify-content:center;padding:24px}
      .card{background:#fff;border-radius:16px;padding:28px 24px;width:380px;box-shadow:0 4px 24px rgba(0,0,0,.10)}
      .shop{font-size:20px;font-weight:700;color:#1a1a2e;text-align:center}
      .tagline{font-size:11px;color:#888;text-align:center;margin-top:2px}
      .divider{border:none;border-top:1.5px dashed #dde3f0;margin:14px 0}
      .meta{font-size:12px;color:#555;margin:3px 0}
      .meta span{font-weight:600;color:#1a1a2e}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      thead tr{background:#1a1a2e;color:#fff}
      th{padding:7px 8px;font-size:11px;font-weight:600;text-align:left}
      th:last-child,td:last-child{text-align:right}
      td{padding:6px 8px;font-size:12px;border-bottom:1px solid #f0f0f0;color:#333}
      .tot-row{display:flex;justify-content:space-between;font-size:12px;color:#666;padding:2px 0}
      .tot-row.grand{font-size:16px;font-weight:700;color:#1a1a2e;border-top:2px solid #1a1a2e;margin-top:6px;padding-top:8px}
      .badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;margin-top:12px}
      .footer{text-align:center;font-size:11px;color:#aaa;margin-top:16px}
      @media print{body{background:#fff;padding:0}.card{box-shadow:none;border-radius:0;width:100%}@page{margin:8mm}}
    </style></head><body>
    <div class="card">
      <div class="shop">🔧 Porwal Autoparts</div>
      <div class="tagline">Auto Parts &amp; Garage</div>
      <hr class="divider"/>
      <div class="meta">🧾 <span>Bill No:</span> ${b.bill_no}</div>
      <div class="meta">📅 <span>Date:</span> ${fmtDate(b.date)}</div>
      ${b.customer !== 'Walk-in' ? `<div class="meta">👤 <span>Customer:</span> ${b.customer}${b.phone ? ` &nbsp;|&nbsp; 📞 ${b.phone}` : ''}</div>` : ''}
      ${b.operator ? `<div class="meta">👷 <span>Operator:</span> ${b.operator}</div>` : ''}
      <hr class="divider"/>
      <table>
        <thead><tr><th>Part</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>${b.items.map(i => `<tr><td>${i.item_name}</td><td>${i.qty}</td><td>₹${i.price.toFixed(2)}</td><td>₹${i.amount.toFixed(2)}</td></tr>`).join('')}</tbody>
      </table>
      <hr class="divider"/>
      <div>
        ${b.discount > 0 ? `<div class="tot-row"><span>Subtotal</span><span>₹${b.subtotal.toFixed(2)}</span></div><div class="tot-row" style="color:#e94560"><span>Discount</span><span>-₹${b.discount.toFixed(2)}</span></div>` : ''}
        <div class="tot-row grand"><span>TOTAL</span><span>₹${b.total.toFixed(2)}</span></div>
      </div>
      <div style="text-align:center"><span class="badge" style="background:${b.payment==='cash'?'#e8f5e9':b.payment==='online'?'#e3f2fd':'#fff3e0'};color:${b.payment==='cash'?'#2e7d32':b.payment==='online'?'#1565c0':'#e65100'}">${payLabel}</span></div>
      <div class="footer">Thank you for your business! 🙏<br/>Powered by Porwal Autoparts</div>
    </div>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`);
    win.document.close();
  }

  async function addCustomer() {
    if (!cForm.name.trim()) return toast('Customer naam zaroori!', 'error');
    const res = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cForm, name: cForm.name.trim() }) });
    const data = await res.json();
    if (!res.ok) return toast(data.error, 'error');
    toast(`${cForm.name} add ho gaya!`);
    broadcast('customers');
    setCForm({ name: '', phone: '', address: '' });
    await loadCustomers();
  }

  async function deleteCustomer(id: number, name: string) {
    setConfirmCust({ id, name });
  }

  async function doDeleteCustomer(id: number, name: string) {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (!res.ok) return toast('Delete nahi hua', 'error');
    toast(`${name} deleted`, 'info');
    broadcast('customers');
    setConfirmCust(null);
    await loadCustomers();
  }

  async function addReturn() {
    if (!rForm.item_name.trim() || !rForm.qty || !rForm.amount) return toast('Sab fields bharo!', 'error');
    const res = await fetch('/api/returns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rForm, item_name: rForm.item_name.trim(), qty: +rForm.qty, amount: +rForm.amount }) });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Return failed', 'error');
    toast('Return darj ho gaya!');
    broadcast('returns');
    setRForm({ item_name: '', qty: '', amount: '', reason: '' });
    await loadReturns();
  }

  const tabs: { key: Tab; label: string; ownerOnly?: boolean }[] = [
    { key: 'reports',   label: '📊 Reports' },
    { key: 'bills',     label: '🧾 Bills',      ownerOnly: true },
    { key: 'sales',     label: '🛒 Sales',     ownerOnly: true },
    { key: 'customers', label: '👥 Customers' },
    { key: 'returns',   label: '↩️ Returns' },
    { key: 'errorlog',  label: '🛠️ Error Log', ownerOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.ownerOnly || isOwner);

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {visibleTabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-[#e94560] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* REPORTS */}
      {tab === 'reports' && (
        <div>
          <div className="flex justify-end mb-4">
            <button className="btn-gray text-sm px-3 py-1.5 rounded-lg" onClick={loadReports}>🔄 Refresh</button>
          </div>

          {sLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {Array.from({ length: 7 }).map((_, i) => <div key={i} className="bg-gray-200 rounded-xl p-5 animate-pulse h-20" />)}
            </div>
          ) : summary ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Total Sales',    value: fmtCurrency(summary.totalSales),    color: 'bg-green-600' },
                  { label: 'Cash Sales',     value: fmtCurrency(summary.cashSales),     color: 'bg-blue-600' },
                  { label: 'Online Sales',   value: fmtCurrency(summary.onlineSales),   color: 'bg-indigo-600' },
                  { label: 'Credit Sales',   value: fmtCurrency(summary.creditSales),   color: 'bg-orange-500' },
                  { label: 'Net Profit',     value: fmtCurrency(summary.profit),        color: 'bg-emerald-600' },
                  { label: 'Items Sold',     value: String(summary.totalItems ?? 0),    color: 'bg-purple-600' },
                  { label: 'Pending Credit', value: fmtCurrency(summary.pendingCredit), color: 'bg-red-600' },
                ].map(c => (
                  <div key={c.label} className={`${c.color} text-white rounded-xl p-4`}>
                    <p className="text-xs opacity-80">{c.label}</p>
                    <p className="text-xl font-bold mt-1">{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Daily Bar Chart */}
              {daily.length > 0 && (
                <div className="form-box">
                  <h3>Last 30 Days — Daily Sales (Revenue vs Profit)</h3>
                  <DailyBarChart data={daily} />
                </div>
              )}

              {/* Top Parts Chart + Table */}
              {topParts.length > 0 && (
                <div className="form-box">
                  <h3>🏆 Top Selling Parts</h3>
                  <TopPartsChart data={topParts} />
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-center py-8">Koi data nahi</p>
          )}
        </div>
      )}

      {/* CUSTOMERS */}
      {tab === 'customers' && (
        <div>
          <div className="form-box">
            <h3>Naya Customer Add Karo</h3>
            <div className="flex flex-wrap gap-2">
              <input className="gb-input" placeholder="Naam *" value={cForm.name} onChange={e => setCForm(p => ({ ...p, name: e.target.value }))} />
              <input className="gb-input" placeholder="Phone" value={cForm.phone} onChange={e => setCForm(p => ({ ...p, phone: e.target.value }))} />
              <input className="gb-input" placeholder="Address" value={cForm.address} onChange={e => setCForm(p => ({ ...p, address: e.target.value }))} />
              <button className="btn" onClick={addCustomer}>➕ Add</button>
            </div>
          </div>
          <table className="gb-table">
            <thead><tr><th>Naam</th><th>Phone</th><th>Address</th><th>Action</th></tr></thead>
            <tbody>
              {cLoading ? <LoadingRows cols={4} /> :
               customers.length === 0 ? <EmptyRow cols={4} msg="Koi customer nahi" /> :
               customers.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.phone || '-'}</td>
                  <td className="text-gray-500 text-xs">{c.address || '-'}</td>
                  <td><button className="btn-sm bg-red-500 text-white" onClick={() => deleteCustomer(c.id, c.name)}>🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          {confirmCust && (
            <ConfirmModal
              message={`"${confirmCust.name}" permanently delete karo?`}
              onConfirm={() => doDeleteCustomer(confirmCust.id, confirmCust.name)}
              onCancel={() => setConfirmCust(null)}
            />
          )}
        </div>
      )}

      {/* SALES — Admin Edit */}
      {tab === 'sales' && isOwner && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="gb-input" style={{ maxWidth: '280px' }} placeholder="🔍 Part / Customer search..." value={saleSearch} onChange={e => setSaleSearch(e.target.value)} />
            <button className="btn-gray text-sm" onClick={loadSales}>🔄 Refresh</button>
            <span style={{ fontSize: '12px', color: 'var(--text3)', marginLeft: 'auto' }}>{sales.length} records</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="gb-table">
              <thead><tr><th>Date</th><th>Part</th><th>Qty</th><th>Amount</th><th>Payment</th><th>Customer</th><th>Actions</th></tr></thead>
              <tbody>
                {salLoading ? <LoadingRows cols={7} /> :
                 sales.filter(s => !saleSearch || fuzzyMatch(s.item_name + ' ' + s.customer, saleSearch))
                 .map(s => (
                  <tr key={s.id}>
                    <td style={{ fontSize: '12px', color: 'var(--text3)' }}>{fmtDate(s.date)}</td>
                    <td style={{ fontWeight: 500 }}>{s.item_name}</td>
                    <td>{s.qty}</td>
                    <td style={{ fontWeight: 600 }}>{fmtCurrency(s.amount)}</td>
                    <td><span className={`badge badge-${s.payment}`}>{s.payment.toUpperCase()}</span></td>
                    <td>{s.customer}</td>
                    <td style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-sm bg-blue-500 text-white" onClick={() => openEditSale(s)}>✏️</button>
                      <button className="btn-sm bg-red-500 text-white" onClick={() => setConfirmSaleId(s.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit Modal */}
          {editSale && editForm && (
            <div className="modal-overlay" onClick={() => { setEditSale(null); setEditForm(null); }}>
              <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                <h3>✏️ Sale Edit — #{editSale.id}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Part Name</label>
                    <input className="gb-input w-full mt-1" value={editForm.item_name} onChange={e => setEditForm(p => p ? { ...p, item_name: e.target.value } : p)} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '90px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Qty</label>
                      <input className="gb-input w-full mt-1" type="number" min="1" value={editForm.qty} onChange={e => setEditForm(p => p ? { ...p, qty: e.target.value } : p)} />
                    </div>
                    <div style={{ flex: 1, minWidth: '110px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Amount ₹</label>
                      <input className="gb-input w-full mt-1" type="number" min="0" value={editForm.amount} onChange={e => setEditForm(p => p ? { ...p, amount: e.target.value } : p)} />
                    </div>
                    <div style={{ flex: 1, minWidth: '130px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Payment</label>
                      <select className="gb-input w-full mt-1" value={editForm.payment} onChange={e => setEditForm(p => p ? { ...p, payment: e.target.value } : p)}>
                        <option value="cash">💵 Cash</option>
                        <option value="online">📱 Online</option>
                        <option value="udhaar">📋 Credit</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Customer</label>
                      <input className="gb-input w-full mt-1" value={editForm.customer} onChange={e => setEditForm(p => p ? { ...p, customer: e.target.value } : p)} />
                    </div>
                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Phone</label>
                      <input className="gb-input w-full mt-1" value={editForm.phone} onChange={e => setEditForm(p => p ? { ...p, phone: e.target.value } : p)} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Date & Time</label>
                    <input className="gb-input w-full mt-1" type="datetime-local" value={editForm.date} onChange={e => setEditForm(p => p ? { ...p, date: e.target.value } : p)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button className="btn-gray" onClick={() => { setEditSale(null); setEditForm(null); }}>Cancel</button>
                  <button className="btn" onClick={saveEditSale} disabled={eSaving}>{eSaving ? '⏳...' : '💾 Save'}</button>
                </div>
              </div>
            </div>
          )}

          {confirmSaleId !== null && (
            <ConfirmModal
              message="Ye sale permanently delete karo?"
              onConfirm={() => doDeleteSale(confirmSaleId)}
              onCancel={() => setConfirmSaleId(null)}
            />
          )}
        </div>
      )}

      {/* BILLS */}
      {tab === 'bills' && isOwner && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{bills.length} bills</span>
            <button className="btn-gray text-sm" onClick={loadBills}>🔄 Refresh</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="gb-table">
              <thead>
                <tr><th>Bill No</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Operator</th><th>Action</th></tr>
              </thead>
              <tbody>
                {billLoading ? <LoadingRows cols={8} /> :
                 bills.length === 0 ? <EmptyRow cols={8} msg="Koi bill nahi" /> :
                 bills.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)', fontSize: '12px' }}>{b.bill_no}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text3)' }}>{fmtDate(b.date)}</td>
                    <td style={{ fontWeight: 500 }}>{b.customer}</td>
                    <td style={{ color: 'var(--text2)', fontSize: '12px' }}>—</td>
                    <td style={{ fontWeight: 700 }}>{fmtCurrency(b.total)}</td>
                    <td><span className={`badge badge-${b.payment}`}>{b.payment.toUpperCase()}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--text3)' }}>{b.operator || '—'}</td>
                    <td style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-sm bg-blue-500 text-white" onClick={() => openBillDetail(b.id)}>👁️ View</button>
                      <button className="btn-sm bg-red-500 text-white" onClick={() => setConfirmBillId(b.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bill Detail Modal */}
          {billDetail && (
            <div className="modal-overlay" onClick={() => setBillDetail(null)}>
              <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ marginBottom: '2px' }}>🧾 Bill #{billDetail.bill_no}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{fmtDate(billDetail.date)}</span>
                  </div>
                  <button style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text3)' }} onClick={() => setBillDetail(null)}>✕</button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', fontSize: '13px' }}>
                  <span>👤 <b>{billDetail.customer}</b></span>
                  {billDetail.phone && <span>📞 {billDetail.phone}</span>}
                  {billDetail.operator && <span>👷 {billDetail.operator}</span>}
                  <span><span className={`badge badge-${billDetail.payment}`}>{billDetail.payment.toUpperCase()}</span></span>
                </div>

                <table className="gb-table" style={{ marginBottom: '12px' }}>
                  <thead><tr><th>Part</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                  <tbody>
                    {billDetail.items.map((i, idx) => (
                      <tr key={idx}>
                        <td>{i.item_name}</td>
                        <td>{i.qty}</td>
                        <td>{fmtCurrency(i.price)}</td>
                        <td style={{ fontWeight: 600 }}>{fmtCurrency(i.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', alignItems: 'flex-end' }}>
                  {billDetail.discount > 0 && (
                    <>
                      <span style={{ color: 'var(--text2)' }}>Subtotal: {fmtCurrency(billDetail.subtotal)}</span>
                      <span style={{ color: '#e94560' }}>Discount: -{fmtCurrency(billDetail.discount)}</span>
                    </>
                  )}
                  <span style={{ fontSize: '16px', fontWeight: 700 }}>Total: {fmtCurrency(billDetail.total)}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                  <button className="btn-green" onClick={() => reprintBill(billDetail)}>🖨️ Reprint Bill</button>
                  <button className="btn-gray" onClick={() => setBillDetail(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {confirmBillId !== null && (
            <ConfirmModal
              message="Ye bill permanently delete karo?"
              onConfirm={() => doDeleteBill(confirmBillId)}
              onCancel={() => setConfirmBillId(null)}
            />
          )}
        </div>
      )}

      {/* RETURNS */}
      {tab === 'returns' && (
        <div>
          <div className="form-box">
            <h3>Return Darj Karo</h3>
            <div className="flex flex-wrap gap-2">
              <input className="gb-input" placeholder="Part naam *" value={rForm.item_name} onChange={e => setRForm(p => ({ ...p, item_name: e.target.value }))} />
              <input className="gb-input w-24" type="number" placeholder="Qty *" min="1" value={rForm.qty} onChange={e => setRForm(p => ({ ...p, qty: e.target.value }))} />
              <input className="gb-input w-28" type="number" placeholder="Amount ₹ *" min="0" value={rForm.amount} onChange={e => setRForm(p => ({ ...p, amount: e.target.value }))} />
              <input className="gb-input" placeholder="Reason" value={rForm.reason} onChange={e => setRForm(p => ({ ...p, reason: e.target.value }))} />
              <button className="btn" onClick={addReturn}>↩️ Return</button>
            </div>
          </div>
          <table className="gb-table">
            <thead><tr><th>Date</th><th>Part</th><th>Qty</th><th>Amount</th><th>Reason</th></tr></thead>
            <tbody>
              {rLoading ? <LoadingRows cols={5} /> :
               returns.length === 0 ? <EmptyRow cols={5} msg="Koi return nahi" /> :
               returns.map(r => (
                <tr key={r.id}>
                  <td className="text-xs text-gray-500">{fmtDate(r.date)}</td>
                  <td>{r.item_name}</td>
                  <td>{r.qty}</td>
                  <td>{fmtCurrency(r.amount)}</td>
                  <td className="text-gray-500 text-xs">{r.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* ERROR LOG */}
      {tab === 'errorlog' && isOwner && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{errorLog.length} errors logged</span>
            <button className="btn-gray text-sm" onClick={() => { clearErrorLog(); setErrorLog([]); toast('Log cleared', 'info'); }}>
              🗑️ Clear Log
            </button>
          </div>
          {errorLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text3)', fontSize: '14px' }}>✅ Koi error nahi</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {errorLog.map((e, i) => (
                <div key={i} style={{
                  background: 'var(--surface)', border: '1px solid #fca5a5',
                  borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{e.msg}</span>
                    <span style={{ color: 'var(--text3)' }}>{e.url} · {new Date(e.ts).toLocaleTimeString()}</span>
                  </div>
                  {e.stack && <pre style={{ color: 'var(--text3)', fontSize: '11px', overflow: 'auto', maxHeight: '80px', margin: 0 }}>{e.stack.split('\n').slice(0, 3).join('\n')}</pre>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
