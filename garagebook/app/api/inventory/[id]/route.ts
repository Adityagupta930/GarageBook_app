import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { apiError, apiOk } from '@/lib/utils';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.action === 'addstock') {
      const qty = Number(body.qty);
      if (!qty || qty <= 0) return apiError('Valid qty daalo');
      const { data: cur } = await db.from('inventory').select('stock').eq('id', id).single();
      if (!cur) return apiError('Part nahi mila', 404);
      const { data, error } = await db.from('inventory')
        .update({ stock: cur.stock + qty })
        .eq('id', id).select().single();
      if (error) throw error;
      return apiOk(data);
    }

    const { stock, price, buy_price, company, sku, category } = body;
    if (stock == null || isNaN(+stock)) return apiError('Valid stock daalo');

    const updates: Record<string, unknown> = { stock: +stock };
    if (price     != null && !isNaN(+price))     updates.price     = +price;
    if (buy_price != null && !isNaN(+buy_price)) updates.buy_price = +buy_price;
    if (company   != null) updates.company  = company.trim();
    if (sku       != null) updates.sku      = sku.trim();
    if (category  != null) updates.category = category.trim();

    const { error } = await db.from('inventory').update(updates).eq('id', id);
    if (error) throw error;
    return apiOk({ success: true });
  } catch (e) {
    console.error('[PUT /api/inventory/:id]', e);
    return apiError('Update karne mein error', 500);
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { error } = await db.from('inventory').delete().eq('id', id);
    if (error) throw error;
    return apiOk({ success: true });
  } catch (e) {
    console.error('[DELETE /api/inventory/:id]', e);
    return apiError('Delete karne mein error', 500);
  }
}
