'use client';
import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/components/Toast';
import { fmtDate } from '@/lib/utils';
import { broadcast, listenSync } from '@/lib/sync';
import CustomerAutocomplete from '@/components/CustomerAutocomplete';
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
  const [shopName, setShopName] = useState('Porwal Autoparts');
  const [saving, setSaving]       = useState(false);
  const [emailTo, setEmailTo]     = useState('');
  const [sending, setSending]     = useState(false);
  const [imgLoading, setImgLoading] = useState(false);

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
    const unsync = listenSync(['inventory'], loadInv);
    // Load pending bill from sale page
    try {
      const pending = sessionStorage.getItem('gb_pending_bill');
      if (pending) {
        const b = JSON.parse(pending);
        if (b.items?.length)  setItems(b.items);
        if (b.customer)       setCustomer(b.customer);
        if (b.phone)          setPhone(b.phone);
        if (b.payment)        setPayment(b.payment);
        if (b.discount)       setDiscount(String(b.discount));
        sessionStorage.removeItem('gb_pending_bill');
      }
    } catch {}
    return unsync;
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
    const displayName = item.name + (item.company ? ` (${item.company})` : '');
    setItems(p => {
      const ex = p.find(i => i.item_id === item.id);
      if (ex) return p.map(i => i.item_id === item.id ? { ...i, qty: i.qty + +qty } : i);
      return [...p, { item_id: item.id, item_name: displayName, qty: +qty, price: item.price }];
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

  async function downloadBillImage(): Promise<string | null> {
    // Render bill in a temp visible div, capture, then remove
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:420px;background:#f4f6fb;padding:24px;font-family:Arial,sans-serif';
    container.innerHTML = getBillHTML(false);
    document.body.appendChild(container);
    // Wait for fonts/layout
    await new Promise(r => setTimeout(r, 300));
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, backgroundColor: '#f4f6fb',
      logging: false,
    });
    document.body.removeChild(container);
    return canvas.toDataURL('image/png');
  }

  // Convert dataURL to File for Web Share API
  function dataUrlToFile(dataUrl: string, filename: string): File {
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  }

  async function shareBillImage() {
    if (!items.length) return toast('Bill mein koi item nahi!', 'error');
    setImgLoading(true);
    try {
      const dataUrl  = await downloadBillImage();
      if (!dataUrl) return;
      const filename = `bill-${customer.trim() || 'walkin'}-${Date.now()}.png`;
      const file     = dataUrlToFile(dataUrl, filename);

      // Web Share API — opens native share sheet (WhatsApp, Gmail, etc.)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Bill — ${shopName}`,
          text: `🔧 ${shopName}\nTotal: ₹${total.toFixed(2)}\n\nThank you! 🙏`,
        });
        toast('✅ Bill share ho gaya!');
      } else {
        // Fallback: direct download
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        a.click();
        toast('📸 Image download ho gayi (share manually karo)');
      }
    } catch (e) {
      // User cancelled share — not an error
      if (e instanceof Error && e.name !== 'AbortError')
        toast('Share nahi hua', 'error');
    } finally {
      setImgLoading(false);
    }
  }

  async function shareImageWhatsApp() {
    if (!items.length) return toast('Bill mein koi item nahi!', 'error');
    const num = phone.trim().replace(/\D/g, '');
    if (!num) return toast('Customer ka phone number daalo!', 'error');
    setImgLoading(true);
    try {
      const dataUrl = await downloadBillImage();
      if (!dataUrl) return;
      // Download image
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `bill-${customer.trim() || 'walkin'}-${Date.now()}.png`;
      a.click();
      // Open WhatsApp after short delay
      setTimeout(() => {
        const intlNum = num.startsWith('91') ? num : `91${num}`;
        window.open(`https://wa.me/${intlNum}?text=${encodeURIComponent('🔧 *' + shopName + '*\n\nBill image attached 👆\n\n_Thank you for your business! 🙏_')}`, '_blank');
        toast('📸 Image download hui — WhatsApp mein attach karo!');
      }, 500);
    } finally {
      setImgLoading(false);
    }
  }

  async function saveBillImage() {
    if (!items.length) return toast('Bill mein koi item nahi!', 'error');
    setImgLoading(true);
    try {
      const dataUrl = await downloadBillImage();
      if (!dataUrl) return;
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `bill-${customer.trim() || 'walkin'}-${Date.now()}.png`;
      a.click();
      toast('📸 Bill image download ho gayi!');
    } finally {
      setImgLoading(false);
    }
  }

  function sendWhatsApp() {
    if (!items.length) return toast('Bill mein koi item nahi!', 'error');
    const num = phone.trim().replace(/\D/g, '');
    if (!num) return toast('Customer ka phone number daalo!', 'error');
    const payLabel = payment === 'cash' ? 'Cash 💵' : payment === 'online' ? 'Online 📱' : 'Credit / Udhaar 📋';
    const dateStr  = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const lines = items.map(i => `▪ ${i.item_name} ×${i.qty} = ₹${(i.qty * i.price).toFixed(2)}`).join('\n');
    const msg = [
      `🔧 *${shopName}*`,
      `📅 *Date:* ${dateStr}`,
      customer.trim() ? `👤 *Customer:* ${customer.trim()}` : null,
      ``, lines, ``,
      discountAmt > 0 ? `Subtotal: ₹${subtotal.toFixed(2)}` : null,
      discountAmt > 0 ? `Discount: -₹${discountAmt.toFixed(2)}` : null,
      `*Total: ₹${total.toFixed(2)}*`,
      `💳 *Payment:* ${payLabel}`,
      `_Thank you! 🙏_`,
    ].filter(v => v !== null).join('\n');
    const intlNum = num.startsWith('91') ? num : `91${num}`;
    window.open(`https://wa.me/${intlNum}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function printBill() {
    if (!items.length) return toast('Bill mein koi item nahi!', 'error');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(getBillHTML(true));
    win.document.close();
  }

  function getBillHTML(withPrint = false) {
    const dateStr = fmtDate(new Date().toISOString());
    const payLabel = payment === 'cash' ? 'Cash 💵' : payment === 'online' ? 'Online 📱' : 'Credit / Udhaar 📋';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Bill</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f6fb;display:flex;justify-content:center;padding:24px}
      .card{background:#fff;border-radius:16px;padding:28px 24px;width:380px;box-shadow:0 4px 24px rgba(0,0,0,.10)}
      .header{text-align:center;margin-bottom:18px}
      .shop{font-size:20px;font-weight:700;color:#1a1a2e;letter-spacing:.5px}
      .tagline{font-size:11px;color:#888;margin-top:2px}
      .divider{border:none;border-top:1.5px dashed #dde3f0;margin:14px 0}
      .meta{font-size:12px;color:#555;margin:3px 0}
      .meta span{font-weight:600;color:#1a1a2e}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      thead tr{background:#1a1a2e;color:#fff}
      th{padding:7px 8px;font-size:11px;font-weight:600;text-align:left}
      th:last-child,td:last-child{text-align:right}
      td{padding:6px 8px;font-size:12px;border-bottom:1px solid #f0f0f0;color:#333}
      tbody tr:last-child td{border-bottom:none}
      .totals{margin-top:4px}
      .tot-row{display:flex;justify-content:space-between;font-size:12px;color:#666;padding:2px 0}
      .tot-row.disc{color:#e94560}
      .tot-row.grand{font-size:16px;font-weight:700;color:#1a1a2e;border-top:2px solid #1a1a2e;margin-top:6px;padding-top:8px}
      .badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;margin-top:12px}
      .badge.cash{background:#e8f5e9;color:#2e7d32}
      .badge.online{background:#e3f2fd;color:#1565c0}
      .badge.udhaar{background:#fff3e0;color:#e65100}
      .footer{text-align:center;font-size:11px;color:#aaa;margin-top:16px}
      .bill-no{font-size:10px;color:#bbb;text-align:right;margin-bottom:4px}
      @media print{body{background:#fff;padding:0}.card{box-shadow:none;border-radius:0;width:100%}@page{margin:8mm}}
    </style></head><body>
    <div class="card">
      <div class="bill-no">#${Date.now().toString().slice(-6)}</div>
      <div class="header">
        <div class="shop">🔧 ${shopName}</div>
        <div class="tagline">Auto Parts &amp; Garage</div>
      </div>
      <hr class="divider"/>
      <div class="meta">📅 <span>Date:</span> ${dateStr}</div>
      ${customer ? `<div class="meta">👤 <span>Customer:</span> ${customer}${phone ? ` &nbsp;|&nbsp; 📞 ${phone}` : ''}</div>` : ''}
      <hr class="divider"/>
      <table>
        <thead><tr><th>Part</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>
          ${items.map(i => `<tr><td>${i.item_name}</td><td>${i.qty}</td><td>₹${i.price.toFixed(2)}</td><td>₹${(i.qty * i.price).toFixed(2)}</td></tr>`).join('')}
        </tbody>
      </table>
      <hr class="divider"/>
      <div class="totals">
        ${discountAmt > 0 ? `<div class="tot-row"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>` : ''}
        ${discountAmt > 0 ? `<div class="tot-row disc"><span>Discount</span><span>-₹${discountAmt.toFixed(2)}</span></div>` : ''}
        <div class="tot-row grand"><span>TOTAL</span><span>₹${total.toFixed(2)}</span></div>
      </div>
      <div style="text-align:center">
        <span class="badge ${payment}">${payLabel}</span>
      </div>
      <div class="footer">Thank you for your business! 🙏<br/>Powered by GarageBook</div>
    </div>
    ${withPrint ? '<script>window.onload=()=>window.print()<\/script>' : ''}
    </body></html>`;
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
          <CustomerAutocomplete
            value={customer}
            onChange={(name, phone) => { setCustomer(name); if (phone !== undefined) setPhone(phone); }}
            placeholder={payment === 'udhaar' ? 'Customer naam *' : 'Customer naam (optional)'}
            required={payment === 'udhaar'}
          />
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
            <button className="btn-green" onClick={printBill}>🖨️ Print / PDF</button>
            <button className="btn-blue" onClick={saveBillImage} disabled={imgLoading}>
              {imgLoading ? '⏳...' : '📸 Image Save'}
            </button>
            <button
              onClick={shareBillImage}
              disabled={imgLoading || !items.length}
              style={{
                padding: '8px 16px', background: '#7c3aed', color: '#fff',
                border: 'none', borderRadius: '7px', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                opacity: (imgLoading || !items.length) ? .5 : 1,
                transition: 'background .15s',
              }}>
              {imgLoading ? '⏳...' : '📤 Share Bill'}
            </button>
            <button className="btn-gray" onClick={() => { setItems([]); setDiscount('0'); }}>🗑️ Clear</button>
          </div>

          {/* Send Options */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px' }}>
              📤 Bill Share Karo
            </div>

            {/* Native Share (WhatsApp / Gmail / Telegram sab) */}
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px', marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px' }}>
                📱 <b>Share Bill Image</b> — WhatsApp, Gmail, Telegram, kuch bhi
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="gb-input"
                  type="tel"
                  placeholder="Customer phone (optional)"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ flex: 1, minWidth: '180px' }}
                />
                <button
                  onClick={shareBillImage}
                  disabled={imgLoading || !items.length}
                  style={{
                    padding: '8px 18px', background: '#25d366', color: '#fff',
                    border: 'none', borderRadius: '7px', fontSize: '13px',
                    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    opacity: (imgLoading || !items.length) ? .5 : 1,
                  }}>
                  {imgLoading ? '⏳...' : '📤 Share Image'}
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
                ℹ️ Phone mein share sheet khulega — WhatsApp mein directly bhej sakte ho
              </div>
            </div>

            {/* Email */}
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>✉️ Email pe bhejo</div>
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
        </div>
      )}
    </div>
  );
}
