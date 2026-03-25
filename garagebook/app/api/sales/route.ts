import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const from    = searchParams.get('from');
    const to      = searchParams.get('to');
    const payment = searchParams.get('payment');
    const limit   = searchParams.get('limit');

    let sql = 'SELECT * FROM sales WHERE 1=1';
    const args: (string | number)[] = [];
    if (from)    { sql += ' AND date >= ?'; args.push(from); }
    if (to)      { sql += ' AND date <= ?'; args.push(to + ' 23:59:59'); }
    if (payment) { sql += ' AND payment = ?'; args.push(payment); }
    sql += ' ORDER BY date DESC';
    if (limit && !isNaN(+limit)) { sql += ' LIMIT ?'; args.push(+limit); }

    const result = await db.execute({ sql, args });
    return apiOk(result.rows);
  } catch (e) {
    console.error('[GET /api/sales]', e);
    return apiError('Sales fetch karne mein error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { item_id, item_name, qty, amount, payment, customer, phone, notes } = await req.json();

    if (!item_name?.trim()) return apiError('Item naam zaroori hai');
    if (!qty || isNaN(+qty) || +qty <= 0) return apiError('Valid qty daalo');
    if (!amount || isNaN(+amount) || +amount < 0) return apiError('Valid amount daalo');
    if (!['cash', 'online', 'udhaar'].includes(payment)) return apiError('Payment type galat hai');
    if (payment === 'udhaar' && !customer?.trim()) return apiError('Credit ke liye customer naam zaroori');

    const itemRes = await db.execute({ sql: 'SELECT * FROM inventory WHERE id = ?', args: [item_id] });
    if (!itemRes.rows.length) return apiError('Part nahi mila', 404);
    const item = itemRes.rows[0] as unknown as { id: number; stock: number; buy_price: number };
    if (Number(item.stock) < +qty) return apiError(`Sirf ${item.stock} stock bacha hai`);

    const unitPrice = +amount / +qty;
    const belowCost = unitPrice < Number(item.buy_price);

    const result = await db.batch([
      { sql: 'UPDATE inventory SET stock = stock - ? WHERE id = ?', args: [+qty, item_id] },
      {
        sql: `INSERT INTO sales (item_id, item_name, qty, amount, buy_price, payment, customer, phone, udhaar_paid, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [item_id, item_name.trim(), +qty, +amount, item.buy_price, payment,
               customer?.trim() || 'Walk-in', phone?.trim() || '',
               payment !== 'udhaar' ? 1 : 0, notes?.trim() || ''],
      },
    ], 'write');

    return apiOk({ id: Number(result[1].lastInsertRowid), belowCost }, 201);
  } catch (e) {
    console.error('[POST /api/sales]', e);
    return apiError('Sale save karne mein error', 500);
  }
}
