import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { apiError, apiOk } from '@/lib/utils';

export async function GET() {
  try {
    const { data, error } = await db.from('returns').select('*').order('date', { ascending: false });
    if (error) throw error;
    return apiOk(data);
  } catch (e) {
    console.error('[GET /api/returns]', e);
    return apiError('Returns fetch karne mein error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sale_id, item_id, item_name, qty, amount, reason } = await req.json();
    if (!item_name?.trim()) return apiError('Item naam zaroori hai');
    if (!qty || isNaN(+qty) || +qty <= 0) return apiError('Valid qty daalo');
    if (!amount || isNaN(+amount)) return apiError('Valid amount daalo');

    // Restore stock if item_id given
    if (item_id) {
      const { data: inv } = await db.from('inventory').select('stock').eq('id', item_id).single();
      if (inv) await db.from('inventory').update({ stock: inv.stock + +qty }).eq('id', item_id);
    }

    const { data, error } = await db.from('returns').insert({
      sale_id: sale_id ?? null, item_id: item_id ?? null,
      item_name: item_name.trim(), qty: +qty, amount: +amount,
      reason: reason?.trim() || '',
    }).select().single();
    if (error) throw error;
    return apiOk({ id: data.id }, 201);
  } catch (e) {
    console.error('[POST /api/returns]', e);
    return apiError('Return darj karne mein error', 500);
  }
}
