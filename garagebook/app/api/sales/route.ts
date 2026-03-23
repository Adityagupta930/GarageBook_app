import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const from    = searchParams.get('from');
    const to      = searchParams.get('to');
    const payment = searchParams.get('payment');

    let query = 'SELECT * FROM sales WHERE 1=1';
    const params: string[] = [];
    if (from)    { query += ' AND date >= ?'; params.push(from); }
    if (to)      { query += ' AND date <= ?'; params.push(to + ' 23:59:59'); }
    if (payment) { query += ' AND payment = ?'; params.push(payment); }
    query += ' ORDER BY date DESC';

    return apiOk(db.prepare(query).all(...params));
  } catch (e) {
    console.error('[GET /api/sales]', e);
    return apiError('Sales fetch karne mein error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { item_id, item_name, qty, amount, payment, customer, phone } = await req.json();

    if (!item_name?.trim()) return apiError('Item naam zaroori hai');
    if (!qty || isNaN(+qty) || +qty <= 0) return apiError('Valid qty daalo');
    if (!amount || isNaN(+amount) || +amount < 0) return apiError('Valid amount daalo');
    if (!['cash', 'online', 'udhaar'].includes(payment)) return apiError('Payment type galat hai');
    if (payment === 'udhaar' && !customer?.trim()) return apiError('Credit ke liye customer naam zaroori');

    const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(item_id) as
      { id: number; stock: number; buy_price: number } | undefined;
    if (!item) return apiError('Part nahi mila', 404);
    if (item.stock < +qty) return apiError(`Sirf ${item.stock} stock bacha hai`);

    // Use transaction — stock deduction + sale insert atomic
    const insertSale = db.transaction(() => {
      db.prepare('UPDATE inventory SET stock = stock - ? WHERE id = ?').run(+qty, item_id);
      return db.prepare(
        `INSERT INTO sales (item_id, item_name, qty, amount, buy_price, payment, customer, phone, udhaar_paid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        item_id, item_name.trim(), +qty, +amount, item.buy_price,
        payment, customer?.trim() || 'Walk-in', phone?.trim() || '',
        payment !== 'udhaar' ? 1 : 0
      );
    });

    const result = insertSale();
    return apiOk({ id: result.lastInsertRowid }, 201);
  } catch (e) {
    console.error('[POST /api/sales]', e);
    return apiError('Sale save karne mein error', 500);
  }
}
