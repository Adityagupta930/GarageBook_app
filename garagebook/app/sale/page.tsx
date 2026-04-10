'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from '@/components/Toast';
import { fuzzyMatch } from '@/lib/utils';
import { enqueueOfflineSale, useOfflineSync } from '@/hooks/useOfflineSync';
import { broadcast, listenSync } from '@/lib/sync';
import { useOperator } from '@/hooks/useOperator';
import OperatorModal from '@/components/OperatorModal';
import CustomerAutocomplete from '@/components/CustomerAutocomplete';
import type { InventoryItem } from '@/types';

const FREQ_KEY = 'gb_freq_items';

function getFreq(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(FREQ_KEY) || '{}'); } catch { return {}; }
}
function bumpFreq(id: number) {
  const f = getFreq(); f[id] = (f[id] || 0) + 1;
  localStorage.setItem(FREQ_KEY, JSON.stringify(f));
}

export default function SalePage() {
  const [inv, setInv]           = useState<InventoryItem[]>([]);
  const [recentSales, setRecentSales] = useState<{item_name:string; qty:number; amount:number; payment:string}[]>([]);
  const [search, setSearch]     = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [itemId, setItemId]     = useState('');
  const [qty, setQty]           = useState('1');
  const [price, setPrice]       = useState('');
  const [discount, setDiscount] = useState('0');
  const [payment, setPayment]   = useState<'cash' | 'online' | 'udhaar'>('cash');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState(false);
  const [lastBill, setLastBill] = useState(false);
  const [notes, setNotes]       = useState('');
  const searchRef               = useRef<HTMLInputElement>(null);

  const { pendingCount } = useOfflineSync();
  const { operator, asking, input, setInput, confirm, change } = useOperator();

  const loadInv = useCallback(async () => {
    const data: InventoryItem[] = await fetch('/api/inventory?instock=1').then(r => r.json());
    setInv(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    loadInv();
    const unsync = listenSync(['inventory'], loadInv);
    return unsync;
  }, [loadInv]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
        recordSale();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, qty, price, discount, payment, customer, phone, inv]);

  const freq        = getFreq();
  const selectedItem = inv.find(i => i.id === +itemId);
  const baseAmount  = price ? (+qty * +price) : 0;
  const finalAmount = Math.max(0, baseAmount - +discount).toFixed(2);

  const filtered = inv
    .filter(i => i.stock > 0)
    .filter(i => !search || fuzzyMatch(i.name + ' ' + (i.company || '') + ' ' + (i.sku || ''), search))
    .sort((a, b) => {
      if (!search) return (freq[b.id] || 0) - (freq[a.id] || 0);
      const q = search.toLowerCase();
      // Exact name match first
      const aExact = a.name.toLowerCase().startsWith(q) ? 1 : 0;
      const bExact = b.name.toLowerCase().startsWith(q) ? 1 : 0;
      if (bExact !== aExact) return bExact - aExact;
      // Then by frequency
      return (freq[b.id] || 0) - (freq[a.id] || 0);
    });

  function selectItem(item: InventoryItem) {
    setItemId(String(item.id));
    setPrice(String(item.price));
    setSearch(item.name + (item.company ? ` (${item.company})` : ''));
    setDiscount('0');
    setShowDrop(false);
    setActiveIdx(-1);
  }

  function highlightMatch(text: string, query: string) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<mark style={{ background: '#fef08a', color: '#111', borderRadius: '2px', padding: '0 1px' }}>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
  }

  function reset() {
    setItemId(''); setQty('1'); setPrice(''); setDiscount('0');
    setCustomer(''); setPhone(''); setPayment('cash'); setSearch(''); setNotes('');
  }

  async function recordSale() {
    if (!itemId) return toast('Part select karo!', 'error');
    if (!qty || +qty <= 0) return toast('Valid qty daalo!', 'error');
    if (payment === 'udhaar' && !customer.trim()) return toast('Credit ke liye customer naam zaroori!', 'error');

    const item = inv.find(i => i.id === +itemId);
    if (!item) return toast('Part nahi mila!', 'error');
    if (+qty > item.stock) return toast(`Sirf ${item.stock} stock bacha hai!`, 'error');

    // Capture ALL values BEFORE reset() clears state
    const sv = {
      itemId:   +itemId,
      itemName: item.name + (item.company ? ` (${item.company})` : ''),
      qty:      +qty,
      price:    +price,
      base:     baseAmount,
      discount: +discount,
      final:    +finalAmount,
      payment,
      customer: customer.trim() || 'Walk-in',
      phone:    phone.trim(),
      notes:    notes.trim(),
      operator,
      buyPrice: item.buy_price,
    };

    // Optimistic UI — update stock instantly
    setInv(prev => prev.map(i => i.id === sv.itemId ? { ...i, stock: i.stock - sv.qty } : i));
    setSuccess(true);
    setTimeout(() => setSuccess(false), 800);
    bumpFreq(sv.itemId);
    reset();
    setSaving(true);

    const offlinePayload = {
      item_id: sv.itemId, item_name: sv.itemName,
      qty: sv.qty, amount: sv.final,
      payment: sv.payment, customer: sv.customer,
      phone: sv.phone, notes: sv.notes,
    };

    try {
      if (!navigator.onLine) { enqueueOfflineSale(offlinePayload); return; }

      // Save to /api/bills — internally also saves to sales table
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: sv.customer,
          phone:    sv.phone,
          payment:  sv.payment,
          subtotal: sv.base,
          discount: sv.discount,
          total:    sv.final,
          operator: sv.operator,
          notes:    sv.notes,
          items: [{
            item_id:   sv.itemId,
            item_name: sv.itemName,
            qty:       sv.qty,
            price:     sv.price,
            amount:    sv.final,
          }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        await loadInv(); // rollback optimistic
        return toast(data.error || 'Sale save nahi hua', 'error');
      }

      const belowCost = sv.price > 0 && (sv.final / sv.qty) < sv.buyPrice;
      if (belowCost) toast(`⚠️ ${item.name} — cost price se kam mein becha!`, 'info');
      else toast(`✅ ${item.name} ×${sv.qty} = ₹${sv.final.toFixed(2)} (${sv.payment.toUpperCase()}) — #${data.bill_no}`);

      setRecentSales(p => [{ item_name: item.name, qty: sv.qty, amount: sv.final, payment: sv.payment }, ...p].slice(0, 5));
      broadcast('sales');
      broadcast('inventory');
      sessionStorage.setItem('gb_pending_bill', JSON.stringify({
        items: [{ item_id: item.id, item_name: item.name, qty: sv.qty, price: sv.price }],
        customer: sv.customer, phone: sv.phone,
        payment: sv.payment, discount: sv.discount,
      }));
      setLastBill(true);
    } catch {
      enqueueOfflineSale(offlinePayload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`form-box max-w-2xl${success ? ' success-flash' : ''}`}>
      {asking && <OperatorModal input={input} setInput={setInput} onConfirm={confirm} />}

      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Naya Sale Darj Karo
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {operator && (
            <span style={{ fontSize: '11px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', padding: '2px 8px', borderRadius: '20px', fontWeight: 500, cursor: 'pointer' }}
              onClick={change} title="Operator badlo">
              👤 {operator}
            </span>
          )}
          {pendingCount > 0 && (
            <span style={{ fontSize: '11px', background: '#fef9c3', color: '#a16207', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>
              📴 {pendingCount} pending sync
            </span>
          )}
        </div>
      </h3>

      {/* Fuzzy Search + Dropdown */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <input
          ref={searchRef}
          className="gb-input w-full"
          placeholder="🔍 Part search karo (naam, SKU, company)..."
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDrop(true); setItemId(''); setPrice(''); setActiveIdx(-1); }}
          onFocus={() => setShowDrop(true)}
          onKeyDown={e => {
            const list = filtered.slice(0, 10);
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, list.length - 1)); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); selectItem(list[activeIdx]); }
            if (e.key === 'Escape') setShowDrop(false);
          }}
          autoComplete="off"
        />
        {showDrop && search && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '8px', boxShadow: 'var(--shadow-md)',
            maxHeight: '280px', overflowY: 'auto', marginTop: '4px',
          }}>
            <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text3)', display: 'flex', gap: '12px' }}>
              <span>↑↓ Navigate</span><span>Enter Select</span><span>Esc Close</span>
              <span style={{ marginLeft: 'auto' }}>{filtered.length} results</span>
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text3)', textAlign: 'center' }}>
                Koi part nahi mila
              </div>
            ) : filtered.slice(0, 10).map((i, idx) => (
              <div key={i.id}
                onClick={() => selectItem(i)}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                  borderBottom: '1px solid var(--border)',
                  background: activeIdx === idx ? 'var(--surface2)' : 'transparent',
                  transition: 'background .1s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>
                    {freq[i.id] > 0 && <span style={{ fontSize: '10px', marginRight: '4px' }}>⭐</span>}
                    {highlightMatch(i.name, search)}
                    {i.company && <span style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 400 }}> · {i.company}</span>}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '14px' }}>₹{i.price}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {i.sku && <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'monospace', background: 'var(--surface2)', padding: '1px 5px', borderRadius: '3px' }}>#{i.sku}</span>}
                  {i.category && <span style={{ fontSize: '10px', color: '#2563eb', background: 'rgba(37,99,235,.1)', padding: '1px 6px', borderRadius: '10px' }}>{i.category}</span>}
                  <div style={{ flex: 1, height: '4px', background: 'var(--surface2)', borderRadius: '99px', overflow: 'hidden', maxWidth: '80px' }}>
                    <div style={{ height: '100%', borderRadius: '99px', width: `${Math.min(100, (i.stock / 20) * 100)}%`, background: i.stock <= 3 ? '#ef4444' : i.stock <= 10 ? '#f97316' : '#16a34a' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: i.stock <= 3 ? '#ef4444' : i.stock <= 10 ? '#f97316' : '#16a34a' }}>{i.stock} left</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {showDrop && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowDrop(false)} />}
      </div>

      {/* Selected item info */}
      {selectedItem && (
        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '10px 14px', marginBottom: '12px',
          display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px',
        }}>
          <span>📦 <b>{selectedItem.name}</b>{selectedItem.company && <span style={{ color: 'var(--text3)', fontSize: '12px' }}> · {selectedItem.company}</span>}</span>
          <span>Rate: <b style={{ color: 'var(--primary)' }}>₹{selectedItem.price}</b></span>
          <span>Stock: <b style={{ color: selectedItem.stock <= 3 ? '#f97316' : '#16a34a' }}>{selectedItem.stock}</b></span>
          {baseAmount > 0 && <span>Subtotal: <b>₹{baseAmount.toFixed(2)}</b></span>}
        </div>
      )}

      {/* Qty + Price + Discount + Final */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Qty</label>
          <input className="gb-input w-24" type="number" placeholder="Qty" min="1"
            max={selectedItem?.stock} value={qty}
            onChange={e => setQty(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-28">
          <label className="text-xs text-gray-500">
            Unit Price ₹
            {selectedItem && +price !== selectedItem.price && (
              <span style={{ color: '#f97316', marginLeft: '6px' }}>MRP: ₹{selectedItem.price}</span>
            )}
          </label>
          <input className="gb-input" type="number" min="0" value={price}
            onChange={e => setPrice(e.target.value)}
            style={{ borderColor: selectedItem && +price !== selectedItem.price ? '#f97316' : undefined }}
          />
          {selectedItem && +price > 0 && +price < selectedItem.buy_price && (
            <span style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px' }}>⚠️ Buy price ₹{selectedItem.buy_price} se kam!</span>
          )}
        </div>
        <div className="flex flex-col gap-1 w-28">
          <label className="text-xs text-gray-500">Discount ₹</label>
          <input className="gb-input" type="number" placeholder="0" min="0"
            value={discount} onChange={e => setDiscount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 w-32">
          <label className="text-xs text-gray-500">Final ₹</label>
          <input className="gb-input" type="number" value={finalAmount} readOnly
            style={{ background: '#f0fdf4', color: '#16a34a', fontWeight: 700 }} />
        </div>
      </div>

      {/* Payment + Customer */}
      <div className="flex flex-wrap gap-2">
        <select className="gb-input" value={payment} onChange={e => setPayment(e.target.value as typeof payment)}>
          <option value="cash">💵 Cash</option>
          <option value="online">📱 Online</option>
          <option value="udhaar">📋 Credit (Udhaar)</option>
        </select>
        <CustomerAutocomplete
          value={customer}
          onChange={(name, ph) => { setCustomer(name); if (ph !== undefined) setPhone(ph); }}
          placeholder={payment === 'udhaar' ? 'Customer naam (zaroori!) *' : 'Customer naam (optional)'}
          required={payment === 'udhaar'}
        />
        <input className="gb-input" placeholder="Phone (optional)"
          value={phone} onChange={e => setPhone(e.target.value)} />
        <input className="gb-input w-full" placeholder="📝 Notes / Remarks (optional)"
          value={notes} onChange={e => setNotes(e.target.value)} />
        <button className="btn w-full mt-1" onClick={recordSale} disabled={saving || !itemId}>
          {saving ? '⏳ Saving...' : '✅ Sale Save Karo (Ctrl+Enter)'}
        </button>
        {lastBill && (
          <a href="/bill"
            style={{ display: 'block', textAlign: 'center', padding: '8px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 600, background: '#16a34a', color: '#fff', marginTop: '6px', textDecoration: 'none' }}>
            🧾 Bill Banao / Print / Share
          </a>
        )}
      </div>

      {/* Recent Sales this session */}
      {recentSales.length > 0 && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>
            🕒 Is session ki sales
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {recentSales.map((s, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 10px', borderRadius: '6px',
                background: i === 0 ? 'rgba(34,197,94,.08)' : 'var(--surface2)',
                fontSize: '12px', border: '1px solid var(--border)',
              }}>
                <span style={{ color: 'var(--text)', fontWeight: i === 0 ? 600 : 400 }}>
                  {i === 0 && <span style={{ color: '#16a34a', marginRight: '4px' }}>✓</span>}
                  {s.item_name} ×{s.qty}
                </span>
                <span style={{ color: 'var(--text2)' }}>
                  <b style={{ color: 'var(--text)' }}>₹{s.amount.toFixed(2)}</b>
                  {' · '}
                  <span style={{
                    color: s.payment === 'cash' ? '#16a34a' : s.payment === 'online' ? '#2563eb' : '#ea580c',
                    fontWeight: 600, fontSize: '11px',
                  }}>{s.payment.toUpperCase()}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
