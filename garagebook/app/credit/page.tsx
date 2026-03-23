'use client';
import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/components/Toast';
import { fmtDate, fmtCurrency } from '@/lib/utils';
import type { Sale } from '@/types';

interface CreditGroup { customer: string; phone: string; total: number; }

export default function CreditPage() {
  const [sales, setSales]     = useState<Sale[]>([]);
  const [modal, setModal]     = useState<{ customer: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetch('/api/sales').then(r => r.json());
    setSales(data); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = sales.filter(s => s.payment === 'udhaar' && !s.udhaar_paid);
  const groups  = Object.values(
    pending.reduce<Record<string, CreditGroup>>((acc, s) => {
      const k = `${s.customer}||${s.phone}`;
      if (!acc[k]) acc[k] = { customer: s.customer, phone: s.phone, total: 0 };
      acc[k].total += s.amount;
      return acc;
    }, {})
  );

  async function markPaid(id: number) {
    await fetch(`/api/sales/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'paid' }) });
    toast('Paid mark ho gaya!');
    load();
  }

  const modalSales = modal ? sales.filter(s => s.payment === 'udhaar' && s.customer === modal.customer && s.phone === modal.phone) : [];

  return (
    <div>
      <h3 className="font-semibold text-gray-700 mb-3">📋 Credit Book — Pending Payments</h3>
      <table className="gb-table">
        <thead><tr><th>Customer</th><th>Phone</th><th>Amount Due</th><th>Action</th></tr></thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={4} className="text-center text-gray-400 py-5">Loading...</td></tr>
          ) : groups.length === 0 ? (
            <tr><td colSpan={4} className="text-center text-gray-400 py-5">Koi pending credit nahi! 🎉</td></tr>
          ) : groups.map(g => (
            <tr key={g.customer + g.phone}>
              <td>{g.customer}</td>
              <td>{g.phone || '-'}</td>
              <td className="text-red-600 font-bold">{fmtCurrency(g.total)}</td>
              <td><button className="btn-sm bg-purple-600 text-white" onClick={() => setModal({ customer: g.customer, phone: g.phone })}>👁 View</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="font-bold mb-4">Credit: {modal.customer}{modal.phone ? ` (${modal.phone})` : ''}</h3>
            <table className="gb-table">
              <thead><tr><th>Date</th><th>Part</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {modalSales.map(s => (
                  <tr key={s.id}>
                    <td>{fmtDate(s.date)}</td>
                    <td>{s.item_name} ×{s.qty}</td>
                    <td>{fmtCurrency(s.amount)}</td>
                    <td><span className={`badge ${s.udhaar_paid ? 'badge-paid' : 'badge-udhaar'}`}>{s.udhaar_paid ? 'Paid' : 'Pending'}</span></td>
                    <td>{!s.udhaar_paid && <button className="btn-sm bg-green-600 text-white" onClick={() => markPaid(s.id)}>✅ Paid</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-gray mt-4" onClick={() => setModal(null)}>❌ Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
