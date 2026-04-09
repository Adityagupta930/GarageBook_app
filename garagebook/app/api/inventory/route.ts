import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { apiError, apiOk } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const search   = req.nextUrl.searchParams.get('search');
    const category = req.nextUrl.searchParams.get('category');
    const instock  = req.nextUrl.searchParams.get('instock');

    let query = db.from('inventory').select('*');
    if (search)   query = query.ilike('name', `%${search}%`);
    if (category) query = query.eq('category', category);
    if (instock)  query = query.gt('stock', 0);
    query = query.order('name');

    const { data, error } = await query;
    if (error) throw error;
    return apiOk(data);
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

    // Check duplicate
    const { data: exists } = await db.from('inventory')
      .select('id')
      .ilike('name', name.trim())
      .ilike('company', company?.trim() || '')
      .maybeSingle();
    if (exists) return apiError(`"${name.trim()}" pehle se exist karta hai`, 409);

    if (sku?.trim()) {
      const { data: skuExists } = await db.from('inventory').select('id').eq('sku', sku.trim()).maybeSingle();
      if (skuExists) return apiError('Ye SKU pehle se use ho raha hai', 409);
    }

    const { data, error } = await db.from('inventory').insert({
      name: name.trim(), sku: sku?.trim() || '', category: category?.trim() || '',
      stock: +stock, price: +price, buy_price: +buy_price, company: company?.trim() || '',
    }).select().single();
    if (error) throw error;
    return apiOk(data, 201);
  } catch (e) {
    console.error('[POST /api/inventory]', e);
    return apiError('Part add karne mein error', 500);
  }
}
