'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/components/Toast';
import type { InventoryItem } from '@/types';

export default function SalePage() {
  const [inv, setInv]       = useState<InventoryItem[]>([]);
  const [itemId, setItemId] = useState('');
  const [qty, setQty]       = useState('1');
  const [price, setPrice]   = useState('');
  const [amount, setAmount] = useState('');
  const [payment, setPayment] = useState<'cash' | 'online' | 'udhaar'>('cash');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone]   = useState('');

  useEffect(() => {
    fetch('/api/inventory').then(r => r.json()).then(setInv);
  }, []);

  function onItemSelect(id: string) {
    setItemId(id);
    const item = inv.find(i => i.id === +id);
    if (item) { setPrice(String(item.price)); setAmount(String(+qty * item.price)); }
  }

  function onQtyChange(q: string) {
    setQty(q);
    if (price) setAmount(String(+q * +price));
  }

  async function recordSale() {
    if (!itemId || !qty || !amount) return toast('Part, qty aur amount zaroori hai!', 'error');
    if (payment === 'udhaar' && !customer) return toast('Credit ke liye customer naam zaroori!', 'error');
    const item = inv.find(i => i.id === +itemId);
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: +itemId, item_name: item?.name, qty: +qty, amount: +amount, payment, customer, phone }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error, 'error');
    toast(`✅ ${item?.name} ×${qty} = ₹${amount} (${payment.toUpperCase()})`);
    setItemId(''); setQty('1'); setPrice(''); setAmount(''); setCustomer(''); setPhone(''); setPayment('cash');
    fetch('/api/inventory').then(r => r.json()).then(setInv);
  }

  return (
    <div className="form-box max-w-2xl">
      <h3>Naya Sale Darj Karo</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        <select className="gb-input" value={itemId} onChange={e => onItemSelect(e.target.value)}>
          <option value="">-- Part Select Karo --</option>
          {inv.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock})</option>)}
        </select>
        <input className="gb-input w-24" type="number" placeholder="Qty" min="1" value={qty} onChange={e => onQtyChange(e.target.value)} />
        <input className="gb-input w-28" type="number" placeholder="Unit Price ₹" value={price} readOnly />
        <input className="gb-input w-28" type="number" placeholder="Total ₹" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="gb-input" value={payment} onChange={e => setPayment(e.target.value as typeof payment)}>
          <option value="cash">💵 Cash</option>
          <option value="online">📱 Online</option>
          <option value="udhaar">📋 Credit (Udhaar)</option>
        </select>
        <input className="gb-input" placeholder={payment === 'udhaar' ? 'Customer naam (zaroori!)' : 'Customer naam (optional)'} value={customer} onChange={e => setCustomer(e.target.value)} />
        <input className="gb-input" placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
        <button className="btn" onClick={recordSale}>✅ Sale Save Karo</button>
      </div>
    </div>
  );
}
