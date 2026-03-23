'use client';
import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/components/Toast';
import { LoadingRows, ErrorRow, EmptyRow } from '@/components/TableStates';
import type { InventoryItem } from '@/types';

type EditState = { stock: string; price: string; buy_price: string; company: string; sku: string; category: string };

export default function InventoryPage() {
  const [items, setItems]       = useState<InventoryItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [form, setForm]         = useState({ name: '', sku: '', category: '', stock: '', price: '', buy_price: '', company: '' });
  const [editing, setEditing]   = useState<Record<number, EditState>>({});
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      if (search)    params.set('search', search);
      if (catFilter) params.set('category', catFilter);
      const data = await fetch(`/api/inventory?${params}`).then(r => r.json());
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setError('Parts load nahi hue.');
    } finally {
      setLoading(false);
    }
  }, [search, catFilter]);

  useEffect(() => { load(); }, [load]);

  // All unique categories from loaded items
  const allCategories = [...new Set(items.map(i => i.category).filter(Boolean))];

  async function addItem() {
    const { name, sku, category, stock, price, buy_price, company } = form;
    if (!name.trim() || !stock || !price || !buy_price) return toast('Naam, stock, sell price, buy price zaroori hai!', 'error');
    setSaving(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), sku: sku.trim(), category: category.trim(), stock: +stock, price: +price, buy_price: +buy_price, company: company.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, 'error');
      toast(`"${name.trim()}" add ho gaya!`);
      setForm({ name: '', sku: '', category: '', stock: '', price: '', buy_price: '', company: '' });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: number) {
    const e = editing[id];
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: +e.stock, price: +e.price, buy_price: +e.buy_price, company: e.company.trim(), sku: e.sku.trim(), category: e.category.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error || 'Update failed', 'error');
      toast('Updated!');
      setEditing(p => { const n = { ...p }; delete n[id]; return n; });
      await load();
    } catch { toast('Update nahi hua', 'error'); }
  }

  async function deleteItem(id: number, name: string) {
    if (!confirm(`"${name}" delete karo?`)) return;
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    if (!res.ok) return toast('Delete nahi hua', 'error');
    toast(`"${name}" deleted`, 'info');
    await load();
  }

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }));

  const outCount = items.filter(i => Number(i.stock) === 0).length;
  const lowCount = items.filter(i => Number(i.stock) > 0 && Number(i.stock) <= 3).length;

  return (
    <div>
      {/* Add Form */}
      <div className="form-box">
        <h3>Naya Part Add Karo</h3>
        <div className="flex flex-wrap gap-2">
          <input className="gb-input" placeholder="Part naam *" value={form.name} onChange={f('name')} onKeyDown={e => e.key === 'Enter' && addItem()} />
          <input className="gb-input" placeholder="SKU / Code" value={form.sku} onChange={f('sku')} />
          <input className="gb-input" placeholder="Category (e.g. Engine, Brake)" value={form.category} onChange={f('category')} />
          <input className="gb-input" placeholder="Company" value={form.company} onChange={f('company')} />
          <input className="gb-input w-24" type="number" placeholder="Stock *" min="0" value={form.stock} onChange={f('stock')} />
          <input className="gb-input w-28" type="number" placeholder="Sell ₹ *" min="0" value={form.price} onChange={f('price')} />
          <input className="gb-input w-28" type="number" placeholder="Buy ₹ *" min="0" value={form.buy_price} onChange={f('buy_price')} />
          <button className="btn" onClick={addItem} disabled={saving}>{saving ? '⏳...' : '➕ Add'}</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <input className="gb-input max-w-xs" placeholder="🔍 Search parts..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="gb-input max-w-xs" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || catFilter) && <button className="btn-gray text-sm px-3 rounded-lg" onClick={() => { setSearch(''); setCatFilter(''); }}>✖ Clear</button>}
        <span className="text-xs text-gray-400 ml-auto">{items.length} parts</span>
        {outCount > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">❌ {outCount} Out of Stock</span>}
        {lowCount > 0 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">⚠️ {lowCount} Low Stock</span>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="gb-table">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Company</th>
              <th>Stock</th>
              <th>Sell ₹</th>
              <th>Buy ₹</th>
              <th>Margin</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRows cols={9} /> :
             error   ? <ErrorRow cols={9} msg={error} /> :
             items.length === 0 ? <EmptyRow cols={9} msg={search ? 'Koi part nahi mila' : 'Koi part nahi. Upar se add karo.'} /> :
             items.map(item => {
              const e   = editing[item.id];
              const qty = Number(item.stock);
              const out = qty === 0;
              const low = qty > 0 && qty <= 3;
              const margin = item.price > 0 ? (((item.price - item.buy_price) / item.price) * 100).toFixed(0) : '0';
              return (
                <tr key={item.id} className={out ? 'bg-red-50' : low ? 'bg-orange-50' : ''}>
                  <td className={`font-medium ${out ? 'text-red-600' : low ? 'text-orange-600' : ''}`}>{item.name}</td>
                  <td className="text-xs text-gray-500 font-mono">{e ? <input className="gb-input w-24" value={e.sku} onChange={ev => setEditing(p => ({ ...p, [item.id]: { ...p[item.id], sku: ev.target.value } }))} /> : (item.sku || '—')}</td>
                  <td>{e ? <input className="gb-input w-28" value={e.category} onChange={ev => setEditing(p => ({ ...p, [item.id]: { ...p[item.id], category: ev.target.value } }))} /> : (item.category ? <span className="badge bg-gray-100 text-gray-700">{item.category}</span> : '—')}</td>
                  <td className="text-xs text-gray-500">{e ? <input className="gb-input w-24" value={e.company} onChange={ev => setEditing(p => ({ ...p, [item.id]: { ...p[item.id], company: ev.target.value } }))} /> : (item.company || '—')}</td>
                  <td>
                    {e ? <input className="gb-input w-20" type="number" min="0" value={e.stock} onChange={ev => setEditing(p => ({ ...p, [item.id]: { ...p[item.id], stock: ev.target.value } }))} />
                       : <span className={`font-semibold ${out ? 'text-red-600' : low ? 'text-orange-500' : 'text-gray-800'}`}>{item.stock}{out ? ' ❌' : low ? ' ⚠️' : ''}</span>}
                  </td>
                  <td>{e ? <input className="gb-input w-24" type="number" min="0" value={e.price} onChange={ev => setEditing(p => ({ ...p, [item.id]: { ...p[item.id], price: ev.target.value } }))} /> : `₹${item.price}`}</td>
                  <td className="text-gray-500">{e ? <input className="gb-input w-24" type="number" min="0" value={e.buy_price} onChange={ev => setEditing(p => ({ ...p, [item.id]: { ...p[item.id], buy_price: ev.target.value } }))} /> : `₹${item.buy_price}`}</td>
                  <td><span className={`text-xs font-semibold ${+margin >= 20 ? 'text-green-600' : +margin >= 10 ? 'text-orange-500' : 'text-red-500'}`}>{margin}%</span></td>
                  <td className="flex gap-1 flex-wrap">
                    {e ? (
                      <>
                        <button className="btn-sm bg-green-600 text-white" onClick={() => saveEdit(item.id)}>💾</button>
                        <button className="btn-sm bg-gray-400 text-white" onClick={() => setEditing(p => { const n = { ...p }; delete n[item.id]; return n; })}>✖</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-sm bg-blue-500 text-white"
                          onClick={() => setEditing(p => ({ ...p, [item.id]: { stock: String(item.stock), price: String(item.price), buy_price: String(item.buy_price), company: item.company || '', sku: item.sku || '', category: item.category || '' } }))}>
                          ✏️
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
    </div>
  );
}
