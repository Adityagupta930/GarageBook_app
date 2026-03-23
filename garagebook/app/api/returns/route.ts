import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { apiError } from '@/lib/utils';

export async function GET() {
  return Response.json(db.prepare('SELECT * FROM returns ORDER BY date DESC').all());
}

export async function POST(req: NextRequest) {
  const { sale_id, item_id, item_name, qty, amount, reason } = await req.json();
  if (!item_name || !qty || !amount) return apiError('item_name, qty, amount required');
  if (item_id) db.prepare('UPDATE inventory SET stock = stock + ? WHERE id = ?').run(qty, item_id);
  const result = db.prepare(
    'INSERT INTO returns (sale_id, item_id, item_name, qty, amount, reason) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(sale_id ?? null, item_id ?? null, item_name, qty, amount, reason || '');
  return Response.json({ id: result.lastInsertRowid }, { status: 201 });
}
