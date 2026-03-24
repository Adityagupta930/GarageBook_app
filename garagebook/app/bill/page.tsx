'use client';
import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/components/Toast';
import { fmtDate } from '@/lib/utils';
import { broadcast } from '@/lib/sync';
import type { InventoryItem } from '@/types';

interface BillItem { item_id: number; item_name: string; qty: number; price: number; }

const EMAIL_KEY = 'gb_last_email';

const SHOP_KEY = 'gb_shop_name';

export default function BillPage() {
  const [inv, setInv]           = useState<InventoryItem[]>([]);
  const [items, setItems]       = useState<BillItem[]>([]);
  const [selId, setSelId]       = useState('');
  const [qty, setQty]           = useState('1');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone]       = useState('');
  const [payment, setPayment]   = useState<'cash' | 'online' | 'udhaar'>('cash');
  const [discount, setDiscount] = useState('0');
  const [shopName, setShopName] = useState('GarageBook Auto Parts');
  const [saving, setSaving]     = useState(false);
  const [emailTo, setEmailTo]   = useState('');
  const [sending, setSending]   = useState(false);

  const loadInv = useCallback(async () => {
    const data: InventoryItem[] = await fetch('/api/inventory').then(r => r.json());
    setInv(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    loadInv();
    const saved = localStorage.getItem(SHOP_KEY);
    if (saved) setShopName(saved);
    const lastEmail = localStorage.getItem(EMAIL_KEY);
    if (lastEmail) setEmailTo(lastEmail);
  }, [loadInv]);

  function onShopNameChange(val: string) {
    setShopName(val);
    localStorage.setItem(SHOP_KEY, val);
  }

  function addItem() {
    const item = inv.find(i => i.id === +selId);
    if (!item) return toast('Part select karo!', 'error');
    if (!qty || +qty <= 0) return toast('Valid qty daalo!', 'error');
    if (+qty > item.stock) return toast(`Sirf ${item.stock} stock hai!`, 'error');
    setItems(p => {
      const ex = p.find(i => i.item_id === item.id);
      if (ex) return p.map(i => i.item_id === item.id ? { ...i, qty: i.qty + +qty } : i);
      return [...p, { item_id: item.id, item_name: item.name, qty: +qty, price: item.price }];
    });
    setSelId(''); setQty('1');
  }

  const subtotal    = items.reduce((s, i) => s + i.qty * i.price, 0);
  const discountAmt = Math.min(+discount || 0, subtotal);
  const total       = Math.max(0, subtotal - discountAmt);

  async function saveBill() {
    if (!items.length) return toast('Bill mein koi item nahi!', 'error');
    if (payment === 'udhaar' && !customer.trim()) return toast('Credit ke liye customer naam zaroori!', 'error');
    setSaving(true);
    try {
      // Distribute discount proportionally across items
      await Promise.all(items.map(i => {
        const itemTotal    = i.qty * i.price;
        const itemDiscount = subtotal > 0 ? (itemTotal / subtotal) * discountAmt : 0;
        const finalAmt     = +(itemTotal - itemDiscount).toFixed(2);
        return fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: i.item_id, item_name: i.item_name,
            qty: i.qty, amount: finalAmt,
            payment, customer: customer.trim() || 'Walk-in', phone: phone.trim(),
          }),
        }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); });
      }));
      toast('✅ Bill save ho gaya!');
      broadcast('sales');
      broadcast('inventory');
      setItems([]); setCustomer(''); setPhone(''); setPayment('cash'); setDiscount('0');
      await loadInv();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Bill save nahi hua', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function sendEmail() {
    if (!items.length) return toast('Bill mein koi item nahi!', 'error');
    if (!emailTo.trim() || !emailTo.includes('@')) return toast('Valid email daalo!', 'error');
    setSending(true);
    try {
      localStorage.setItem(EMAIL_KEY, emailTo.trim());
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo.trim(),
          customerName: customer.trim() || 'Walk-in',
          shopName,
          items,
          subtotal,
          discount: discountAmt,
          total,
          payment,
          date: fmtDate(new Date().toISOString()),
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error || 'Email nahi gaya', 'error');
      toast(`✉️ Bill ${emailTo} pe bhej diya!`);
    } finally {
      setSending(false);
    }
  }

  function sendWhatsApp() {
    if (!items.length) return toast('Bill mein koi item nahi!', 'error');
    const num = phone.trim().replace(/\D/g, '');
    if (!num) return toast('Customer ka phone number daalo!', 'error');

    const lines = items.map(i => `  • ${i.item_name} ×${i.qty} = ₹${(i.qty * i.price).toFixed(2)}`).join('\n');
    const discLine = discountAmt > 0 ? `\nDiscount: -₹${discountAmt.toFixed(2)}` : '';
    const payLabel = payment === 'cash' ? '💵 Cash' : payment === 'online' ? '📱 Online' : '📋 Credit (Udhaar)';

    const msg = [
      `🔧 *${shopName}*`,
      `📅 Date: ${fmtDate(new Date().toISOString())}`,
      customer.trim() ? `👤 Customer: ${customer.trim()}` : '',
      '',
      '*Bill Details:*',
      lines,
      discLine,
      `━━━━━━━━━━━━━━`,
      `*Total: ₹${total.toFixed(2)}*`,
      `Payment: ${payLabel}`,
      '',
      '_Thank you for your business! 🙏_',
    ].filter(Boolean).join('\n');

    // India number: add 91 prefix if not present
    const intlNum = num.startsWith('91') ? num : `91${num}`;
    window.open(`https://wa.me/${intlNum}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function printBill() {
    if (!items.length) return toast('Bill mein koi item nahi!', 'error');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Bill — ${shopName}</title><style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:monospace;padding:20px;max-width:380px;margin:auto;font-size:13px}
        h2{text-align:center;font-size:16px;margin-bottom:4px}
        .center{text-align:center;margin:2px 0;color:#555}
        table{width:100%;border-collapse:collapse;margin:10px 0}
        th{background:#1a1a2e;color:#fff;padding:5px 8px;text-align:left;font-size:12px}
        td{padding:4px 8px;border-bottom:1px solid #eee;font-size:12px}
        .sub-row td{border-top:1px dashed #ccc;border-bottom:none;color:#555}
        .disc-row td{color:#e94560;border-bottom:none}
        .total-row td{font-weight:bold;font-size:14px;border-top:2px solid #000;border-bottom:none}
        hr{border:none;border-top:1px dashed #999;margin:8px 0}
        .footer{text-align:center;font-size:11px;color:#888;margin-top:10px}
        @media print{@page{margin:5mm}}
      </style></head><body>
        <h2>${shopName}</h2>
        <p class="center">Date: ${fmtDate(new Date().toISOString())}</p>
        ${customer ? `<p class="center">Customer: ${customer}${phone ? ` | ${phone}` : ''}</p>` : ''}
        <hr/>
        <table>
          <tr><th>Part</th><th>Qty</th><th>Rate</th><th>Total</th></tr>
          ${items.map(i => `<tr><td>${i.item_name}</td><td>${i.qty}</td><td>₹${i.price}</td><td>₹${(i.qty * i.price).toFixed(2)}</td></tr>`).join('')}
          ${discountAmt > 0 ? `
          <tr class="sub-row"><td colspan="3">Subtotal</td><td>₹${subtotal.toFixed(2)}</td></tr>
          <tr class="disc-row"><td colspan="3">Discount</td><td>-₹${discountAmt.toFixed(2)}</td></tr>
          ` : ''}
          <tr class="total-row"><td colspan="3">TOTAL</td><td>₹${total.toFixed(2)}</td></tr>
        </table>
        <hr/>
        <p class="center">Payment: ${payment.toUpperCase()}</p>
        <p class="footer">Thank you for your business! 🙏</p>
        <script>window.onload = () => { window.print(); }</script>
      </body></html>
    `);
    win.document.close();
  }

  return (
    <div className="max-w-2xl">
      <div className="form-box">
        <h3>Shop Details</h3>
        <input className="gb-input w-full" placeholder="Shop naam" value={shopName}
          onChange={e => onShopNameChange(e.target.value)} />
      </div>

      <div className="form-box">
        <h3>Customer Details</h3>
        <div className="flex flex-wrap gap-2">
          <input className="gb-input"
            placeholder={payment === 'udhaar' ? 'Customer naam *' : 'Customer naam (optional)'}
            value={customer} onChange={e => setCustomer(e.target.value)} />
          <input className="gb-input" placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
          <select className="gb-input" value={payment} onChange={e => setPayment(e.target.value as typeof payment)}>
            <option value="cash">💵 Cash</option>
            <option value="online">📱 Online</option>
            <option value="udhaar">📋 Credit</option>
          </select>
        </div>
      </div>

      <div className="form-box">
        <h3>Items Add Karo</h3>
        <div className="flex flex-wrap gap-2">
          <select className="gb-input" value={selId} onChange={e => setSelId(e.target.value)}>
            <option value="">-- Part Select Karo --</option>
            {inv.map(i => (
              <option key={i.id} value={i.id} disabled={i.stock === 0}>
                {i.name}{i.company ? ` (${i.company})` : ''} — ₹{i.price} (Stock: {i.stock}){i.stock === 0 ? ' ❌' : ''}
              </option>
            ))}
          </select>
          <input className="gb-input w-24" type="number" placeholder="Qty" min="1" value={qty}
            onChange={e => setQty(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} />
          <button className="btn" onClick={addItem}>➕ Add</button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="form-box">
          <h3>Bill Preview</h3>
          <table className="gb-table mb-3">
            <thead><tr><th>Part</th><th>Qty</th><th>Rate</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {items.map(i => (
                <tr key={i.item_id}>
                  <td>{i.item_name}</td>
                  <td>{i.qty}</td>
                  <td>₹{i.price}</td>
                  <td className="font-semibold">₹{(i.qty * i.price).toFixed(2)}</td>
                  <td>
                    <button className="btn-sm bg-red-500 text-white"
                      onClick={() => setItems(p => p.filter(x => x.item_id !== i.item_id))}>✖</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Discount + Total */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-sm text-gray-600">Subtotal: <b>₹{subtotal.toFixed(2)}</b></span>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Discount ₹:</label>
              <input className="gb-input w-28" type="number" min="0" max={subtotal}
                value={discount} onChange={e => setDiscount(e.target.value)} />
            </div>
            <span className="text-lg font-bold text-green-700 ml-auto">Total: ₹{total.toFixed(2)}</span>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button className="btn" onClick={saveBill} disabled={saving}>
              {saving ? '⏳ Saving...' : '💾 Save Bill'}
            </button>
            <button className="btn-green" onClick={printBill}>🖨️ Print Bill</button>
            <button className="btn-gray" onClick={() => { setItems([]); setDiscount('0'); }}>🗑️ Clear</button>
          </div>

          {/* Email Bill */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>
              ✉️ Email Bill to Customer
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                className="gb-input"
                type="email"
                placeholder="customer@email.com"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendEmail()}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <button className="btn-blue" onClick={sendEmail} disabled={sending || !items.length}>
                {sending ? '⏳ Sending...' : '✉️ Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
