'use client';
import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/components/Toast';
import { LoadingRows, ErrorRow, EmptyRow } from '@/components/TableStates';
import type { InventoryItem } from '@/types';

export default function InventoryPage() {
  const [items, setItems]     = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [form, setForm]       = useState({ name: '', stock: '', price: '', buy_price: '' });
  const [editing, setEditing] = useState<Record<number, { stock: string; price: string; buy_price: string }>>({});
  const [search, setSearch]   = useState('');
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await fetch(`/api/inventory${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(r => r.json());
      setItems(data);
    } catch {
      setError('Parts load nahi hue. Server check karo.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function addItem() {
    const { name, stock, price, buy_price } = form;
    if (!name.trim() || !stock || !price || !buy_price) return toast('Sab fields bharo!', 'error');
    setSaving(true);
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), stock: +stock, price: +price, buy_price: +buy_price }),
    });
    setSaving(false);
    const data = await res.json();
    if (!res.ok) return toast(data.error, 'error');
    toast(`"${name.trim()}" add ho gaya!`);
    setForm({ name: '', stock: '', price: '', buy_price: '' });
    load();
  }

  async function saveEdit(id: number) {
    const e = editing[id];
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: +e.stock, price: +e.price, buy_price: +e.buy_price }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Update failed', 'error');
    toast('Updated!');
    setEditing(p => { const n = { ...p }; delete n[id]; return n; });
    load();
  }

  async function deleteItem(id: number, name: string) {
    if (!confirm(`"${name}" delete karo?`)) return;
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    if (!res.ok) return toast('Delete nahi hua', 'error');
    toast(`"${name}" deleted`, 'info');
    load();
  }

  return (
    <div>
      <div className="form-box">
        <h3>Naya Part Add Karo</h3>
        <div className="flex flex-wrap gap-2">
          <input className="gb-input" placeholder="Part naam *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addItem()} />
          <input className="gb-input" type="number" placeholder="Stock *" min="0" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} />
          <input className="gb-input" type="number" placeholder="Selling Price ₹ *" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
          <input className="gb-input" type="number" placeholder="Buy Price ₹ *" min="0" value={form.buy_price} onChange={e => setForm(p => ({ ...p, buy_price: e.target.value }))} />
          <button className="btn" onClick={addItem} disabled={saving}>{saving ? '...' : '➕ Add'}</button>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <input className="gb-input max-w-xs" placeholder="🔍 Search parts..." value={search}
          onChange={e => setSearch(e.target.value)} />
        {search && <button className="btn-gray text-sm px-3 rounded-lg" onClick={() => setSearch('')}>✖</button>}
      </div>

      <table className="gb-table">
        <thead><tr><th>Part Name</th><th>Stock</th><th>Sell Price</th><th>Buy Price</th><th>Action</th></tr></thead>
        <tbody>
          {loading ? <LoadingRows cols={5} /> :
           error   ? <ErrorRow cols={5} msg={error} /> :
           items.length === 0 ? <EmptyRow cols={5} msg={search ? 'Koi part nahi mila' : 'Koi part nahi. Upar se add karo.'} /> :
           items.map(item => {
            const e = editing[item.id];
            const low = item.stock <= 3;
            return (
              <tr key={item.id} className={low ? 'bg-red-50' : ''}>
                <td className={low ? 'text-red-600 font-semibold' : ''}>{item.name}{low ? ' ⚠️' : ''}</td>
                <td>{e
                  ? <input className="gb-input w-20" type="number" min="0" value={e.stock} onChange={ev => setEditing(p => ({ ...p, [item.id]: { ...p[item.id], stock: ev.target.value } }))} />
                  : item.stock}
                </td>
                <td>{e
                  ? <input className="gb-input w-24" type="number" min="0" value={e.price} onChange={ev => setEditing(p => ({ ...p, [item.id]: { ...p[item.id], price: ev.target.value } }))} />
                  : `₹${item.price}`}
                </td>
                <td>{e
                  ? <input className="gb-input w-24" type="number" min="0" value={e.buy_price} onChange={ev => setEditing(p => ({ ...p, [item.id]: { ...p[item.id], buy_price: ev.target.value } }))} />
                  : `₹${item.buy_price}`}
                </td>
                <td className="flex gap-1 flex-wrap">
                  {e ? (
                    <>
                      <button className="btn-sm bg-green-600 text-white" onClick={() => saveEdit(item.id)}>💾 Save</button>
                      <button className="btn-sm bg-gray-400 text-white" onClick={() => setEditing(p => { const n = { ...p }; delete n[item.id]; return n; })}>✖</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-sm bg-blue-500 text-white"
                        onClick={() => setEditing(p => ({ ...p, [item.id]: { stock: String(item.stock), price: String(item.price), buy_price: String(item.buy_price) } }))}>
                        ✏️ Edit
                      </button>
                      <button className="btn-sm bg-red-500 text-white" onClick={() => deleteItem(item.id, item.name)}>🗑️</button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
