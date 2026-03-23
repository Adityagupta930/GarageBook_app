'use client';
import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/components/Toast';
import type { InventoryItem } from '@/types';

export default function SalePage() {
  const [inv, setInv]           = useState<InventoryItem[]>([]);
  const [itemId, setItemId]     = useState('');
  const [qty, setQty]           = useState('1');
  const [price, setPrice]       = useState('');
  const [amount, setAmount]     = useState('');
  const [payment, setPayment]   = useState<'cash' | 'online' | 'udhaar'>('cash');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone]       = useState('');
  const [saving, setSaving]     = useState(false);

  const loadInv = useCallback(async () => {
    const data: InventoryItem[] = await fetch('/api/inventory').then(r => r.json());
    setInv(data);
  }, []);

  useEffect(() => { loadInv(); }, [loadInv]);

  function onItemSelect(id: string) {
    setItemId(id);
    const item = inv.find(i => i.id === +id);
    if (item) { setPrice(String(item.price)); setAmount((+qty * item.price).toFixed(2)); }
    else { setPrice(''); setAmount(''); }
  }

  function onQtyChange(q: string) {
    setQty(q);
    if (price) setAmount((+q * +price).toFixed(2));
  }

  async function recordSale() {
    if (!itemId) return toast('Part select karo!', 'error');
    if (!qty || +qty <= 0) return toast('Valid qty daalo!', 'error');
    if (!amount || +amount < 0) return toast('Valid amount daalo!', 'error');
    if (payment === 'udhaar' && !customer.trim()) return toast('Credit ke liye customer naam zaroori!', 'error');

    const item = inv.find(i => i.id === +itemId);
    if (item && +qty > item.stock) return toast(`Sirf ${item.stock} stock bacha hai!`, 'error');

    setSaving(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: +itemId, item_name: item?.name,
          qty: +qty, amount: +amount,
          payment, customer: customer.trim(), phone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, 'error');
      toast(`✅ ${item?.name} ×${qty} = ₹${amount} (${payment.toUpperCase()})`);
      // Reset form
      setItemId(''); setQty('1'); setPrice(''); setAmount('');
      setCustomer(''); setPhone(''); setPayment('cash');
      await loadInv();
    } finally {
      setSaving(false);
    }
  }

  const selectedItem = inv.find(i => i.id === +itemId);

  return (
    <div className="form-box max-w-2xl">
      <h3>Naya Sale Darj Karo</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        <select className="gb-input" value={itemId} onChange={e => onItemSelect(e.target.value)}>
          <option value="">-- Part Select Karo --</option>
          {inv.map(i => (
            <option key={i.id} value={i.id} disabled={i.stock === 0}>
              {i.name}{i.company ? ` (${i.company})` : ''} — Stock: {i.stock}{i.stock === 0 ? ' OUT' : ''}
            </option>
          ))}
        </select>
        <input className="gb-input w-24" type="number" placeholder="Qty" min="1"
          max={selectedItem?.stock} value={qty} onChange={e => onQtyChange(e.target.value)} />
        <input className="gb-input w-28" type="number" placeholder="Unit Price ₹" value={price} readOnly />
        <input className="gb-input w-28" type="number" placeholder="Total ₹" min="0"
          value={amount} onChange={e => setAmount(e.target.value)} />
      </div>

      {selectedItem && (
        <p className="text-xs text-gray-500 mb-2 -mt-1">
          Stock bacha: <span className={selectedItem.stock <= 3 ? 'text-red-500 font-bold' : 'text-green-600 font-bold'}>{selectedItem.stock}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <select className="gb-input" value={payment} onChange={e => setPayment(e.target.value as typeof payment)}>
          <option value="cash">💵 Cash</option>
          <option value="online">📱 Online</option>
          <option value="udhaar">📋 Credit (Udhaar)</option>
        </select>
        <input className="gb-input"
          placeholder={payment === 'udhaar' ? 'Customer naam (zaroori!) *' : 'Customer naam (optional)'}
          value={customer} onChange={e => setCustomer(e.target.value)} />
        <input className="gb-input" placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
        <button className="btn" onClick={recordSale} disabled={saving}>
          {saving ? '⏳ Saving...' : '✅ Sale Save Karo'}
        </button>
      </div>
    </div>
  );
}
