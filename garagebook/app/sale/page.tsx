'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from '@/components/Toast';
import { fuzzyMatch } from '@/lib/utils';
import { enqueueOfflineSale, useOfflineSync } from '@/hooks/useOfflineSync';
import { broadcast, listenSync } from '@/lib/sync';
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
  const [search, setSearch]     = useState('');
  const [showDrop, setShowDrop] = useState(false);
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
  const searchRef               = useRef<HTMLInputElement>(null);

  const { pendingCount } = useOfflineSync();

  const loadInv = useCallback(async () => {
    const data: InventoryItem[] = await fetch('/api/inventory').then(r => r.json());
    setInv(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    loadInv();
    const unsync = listenSync(['inventory'], loadInv);
    return unsync;
  }, [loadInv]);

  // Keyboard shortcut: Enter to submit when form is filled
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.ctrlKey) recordSale();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const freq = getFreq();
  const filtered = inv
    .filter(i => i.stock > 0)
    .filter(i => !search || fuzzyMatch(i.name + ' ' + (i.company || '') + ' ' + (i.sku || ''), search))
    .sort((a, b) => (freq[b.id] || 0) - (freq[a.id] || 0));

  const selectedItem = inv.find(i => i.id === +itemId);
  const baseAmount   = price ? (+qty * +price) : 0;
  const finalAmount  = Math.max(0, baseAmount - +discount).toFixed(2);

  function selectItem(item: InventoryItem) {
    setItemId(String(item.id));
    setPrice(String(item.price));
    setSearch(item.name);
    setDiscount('0');
    setShowDrop(false);
  }

  function reset() {
    setItemId(''); setQty('1'); setPrice(''); setDiscount('0');
    setCustomer(''); setPhone(''); setPayment('cash'); setSearch('');
  }

  async function recordSale() {
    if (!itemId) return toast('Part select karo!', 'error');
    if (!qty || +qty <= 0) return toast('Valid qty daalo!', 'error');
    if (payment === 'udhaar' && !customer.trim()) return toast('Credit ke liye customer naam zaroori!', 'error');

    const item = inv.find(i => i.id === +itemId);
    if (!item) return toast('Part nahi mila!', 'error');
    if (+qty > item.stock) return toast(`Sirf ${item.stock} stock bacha hai!`, 'error');

    const payload = {
      item_id: +itemId, item_name: item.name,
      qty: +qty, amount: +finalAmount,
      payment, customer: customer.trim() || 'Walk-in', phone: phone.trim(),
    };

    // ── Optimistic UI ──────────────────────────────────────────
    setInv(prev => prev.map(i => i.id === +itemId ? { ...i, stock: i.stock - +qty } : i));
    setSuccess(true);
    setTimeout(() => setSuccess(false), 800);
    bumpFreq(+itemId);
    reset();
    setSaving(true);

    try {
      if (!navigator.onLine) { enqueueOfflineSale(payload); return; }
      const res  = await fetch('/api/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        // Rollback optimistic update
        await loadInv();
        return toast(data.error || 'Sale save nahi hua', 'error');
      }
      toast(`✅ ${item.name} ×${qty} = ₹${finalAmount} (${payment.toUpperCase()})`);
      broadcast('sales');
      broadcast('inventory');
      sessionStorage.setItem('gb_pending_bill', JSON.stringify({
        items: [{ item_id: item.id, item_name: item.name, qty: +qty, price: +price }],
        customer: payload.customer,
        phone: payload.phone,
        payment,
        discount: +discount,
      }));
      setLastBill(true);
    } catch {
      enqueueOfflineSale(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`form-box max-w-2xl${success ? ' success-flash' : ''}`}>
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Naya Sale Darj Karo
        {pendingCount > 0 && (
          <span style={{ fontSize: '11px', background: '#fef9c3', color: '#a16207', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>
            📴 {pendingCount} pending sync
          </span>
        )}
      </h3>

      {/* Fuzzy Search + Dropdown */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <input
          ref={searchRef}
          className="gb-input w-full"
          placeholder="🔍 Part search karo (naam, SKU, company)..."
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDrop(true); setItemId(''); setPrice(''); }}
          onFocus={() => setShowDrop(true)}
          autoComplete="off"
        />
        {showDrop && search && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '8px', boxShadow: 'var(--shadow-md)',
            maxHeight: '220px', overflowY: 'auto', marginTop: '4px',
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text3)', textAlign: 'center' }}>
                Koi part nahi mila
              </div>
            ) : filtered.slice(0, 8).map(i => (
              <div key={i.id}
                onClick={() => selectItem(i)}
                style={{
                  padding: '9px 14px', cursor: 'pointer', fontSize: '13px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span>
                  {freq[i.id] > 0 && <span style={{ fontSize: '10px', marginRight: '4px' }}>⭐</span>}
                  <b>{i.name}</b>
                  {i.company && <span style={{ color: 'var(--text3)', fontSize: '11px' }}> · {i.company}</span>}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text2)' }}>
                  ₹{i.price} · <span style={{ color: i.stock <= 3 ? '#f97316' : '#16a34a' }}>{i.stock} left</span>
                </span>
              </div>
            ))}
          </div>
        )}
        {/* Click outside to close */}
        {showDrop && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowDrop(false)} />}
      </div>

      {/* Selected item info */}
      {selectedItem && (
        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '10px 14px', marginBottom: '12px',
          display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px',
        }}>
          <span>📦 <b>{selectedItem.name}</b></span>
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
          <input
            className="gb-input"
            type="number"
            min="0"
            value={price}
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
          <input className="gb-input font-semibold" type="number" value={finalAmount} readOnly
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
          onChange={(name, phone) => { setCustomer(name); if (phone !== undefined) setPhone(phone); }}
          placeholder={payment === 'udhaar' ? 'Customer naam (zaroori!) *' : 'Customer naam (optional)'}
          required={payment === 'udhaar'}
        />
        <input className="gb-input" placeholder="Phone (optional)"
          value={phone} onChange={e => setPhone(e.target.value)} />
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
    </div>
  );
}
