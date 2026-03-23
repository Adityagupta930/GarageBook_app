import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const search   = req.nextUrl.searchParams.get('search');
    const category = req.nextUrl.searchParams.get('category');
    let sql  = 'SELECT * FROM inventory WHERE 1=1';
    const args: string[] = [];
    if (search)   { sql += ' AND LOWER(name) LIKE ?'; args.push(`%${search.toLowerCase()}%`); }
    if (category) { sql += ' AND category = ?'; args.push(category); }
    sql += ' ORDER BY name';
    const result = await db.execute({ sql, args });
    return apiOk(result.rows);
  } catch (e) {
    console.error('[GET /api/inventory]', e);
    return apiError('Failed to fetch inventory', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, sku, category, stock, price, buy_price, company } = await req.json();
    if (!name?.trim()) return apiError('Part naam zaroori hai');
    if (stock == null || isNaN(+stock) || +stock < 0) return apiError('Valid stock daalo');
    if (price == null || isNaN(+price) || +price < 0) return apiError('Valid selling price daalo');
    if (buy_price == null || isNaN(+buy_price) || +buy_price < 0) return apiError('Valid buy price daalo');

    const exists = await db.execute({ sql: 'SELECT id FROM inventory WHERE LOWER(name) = LOWER(?)', args: [name.trim()] });
    if (exists.rows.length) return apiError('Ye part pehle se exist karta hai', 409);

    if (sku?.trim()) {
      const skuExists = await db.execute({ sql: 'SELECT id FROM inventory WHERE sku = ?', args: [sku.trim()] });
      if (skuExists.rows.length) return apiError('Ye SKU pehle se use ho raha hai', 409);
    }

    const result = await db.execute({
      sql: 'INSERT INTO inventory (name, sku, category, stock, price, buy_price, company) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [name.trim(), sku?.trim() || '', category?.trim() || '', +stock, +price, +buy_price, company?.trim() || ''],
    });
    return apiOk({ id: Number(result.lastInsertRowid), name: name.trim(), sku: sku?.trim() || '', category: category?.trim() || '', stock: +stock, price: +price, buy_price: +buy_price, company: company?.trim() || '' }, 201);
  } catch (e) {
    console.error('[POST /api/inventory]', e);
    return apiError('Part add karne mein error', 500);
  }
}
