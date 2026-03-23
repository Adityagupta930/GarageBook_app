import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get('type') || 'summary';
    const from = searchParams.get('from');
    const to   = searchParams.get('to');

    let where = 'WHERE 1=1';
    const params: string[] = [];
    if (from) { where += ' AND date >= ?'; params.push(from); }
    if (to)   { where += ' AND date <= ?'; params.push(to + ' 23:59:59'); }

    if (type === 'daily') {
      return apiOk(db.prepare(`
        SELECT DATE(date) as day,
          SUM(amount) as total,
          SUM(CASE WHEN payment != 'udhaar' THEN amount ELSE 0 END) as earned,
          SUM((amount / qty - buy_price) * qty) as profit,
          COUNT(*) as count
        FROM sales ${where}
        GROUP BY DATE(date) ORDER BY day DESC
      `).all(...params));
    }

    if (type === 'topparts') {
      return apiOk(db.prepare(`
        SELECT item_name, SUM(qty) as total_qty, SUM(amount) as total_amount
        FROM sales GROUP BY item_name ORDER BY total_qty DESC LIMIT 10
      `).all());
    }

    // summary
    const sales = db.prepare(`SELECT * FROM sales ${where}`).all() as {
      amount: number; qty: number; buy_price: number; payment: string;
    }[];
    const totalSales  = sales.reduce((s, r) => s + r.amount, 0);
    const cashSales   = sales.filter(r => r.payment === 'cash').reduce((s, r) => s + r.amount, 0);
    const onlineSales = sales.filter(r => r.payment === 'online').reduce((s, r) => s + r.amount, 0);
    const creditSales = sales.filter(r => r.payment === 'udhaar').reduce((s, r) => s + r.amount, 0);
    const profit      = sales.reduce((s, r) => s + ((r.amount / r.qty) - r.buy_price) * r.qty, 0);
    const totalItems  = sales.reduce((s, r) => s + r.qty, 0);
    const pending     = db.prepare(
      'SELECT SUM(amount) as total FROM sales WHERE payment = "udhaar" AND udhaar_paid = 0'
    ).get() as { total: number | null };

    return apiOk({ totalSales, cashSales, onlineSales, creditSales, profit, totalItems, pendingCredit: pending.total ?? 0 });
  } catch (e) {
    console.error('[GET /api/reports]', e);
    return apiError('Reports fetch karne mein error', 500);
  }
}
