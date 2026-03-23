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
      db.prepare('UPDATE inventory SET stock = stock + ? WHERE id = ?').run(qty, id);
      return apiOk(db.prepare('SELECT * FROM inventory WHERE id = ?').get(id));
    }

    const { stock, price, buy_price } = body;
    if (stock == null || isNaN(+stock)) return apiError('Valid stock daalo');
    if (price == null || isNaN(+price)) return apiError('Valid price daalo');

    const info = db.prepare('UPDATE inventory SET stock = ?, price = ?, buy_price = ? WHERE id = ?')
      .run(+stock, +price, buy_price != null ? +buy_price : 0, id);

    if (info.changes === 0) return apiError('Part nahi mila', 404);
    return apiOk({ success: true });
  } catch (e) {
    console.error('[PUT /api/inventory/:id]', e);
    return apiError('Update karne mein error', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const info = db.prepare('DELETE FROM inventory WHERE id = ?').run(id);
    if (info.changes === 0) return apiError('Part nahi mila', 404);
    return apiOk({ success: true });
  } catch (e) {
    console.error('[DELETE /api/inventory/:id]', e);
    return apiError('Delete karne mein error', 500);
  }
}
