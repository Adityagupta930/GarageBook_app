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

    let query = db.from('sales').select('*');
    if (from)    query = query.gte('date', from);
    if (to)      query = query.lte('date', to + 'T23:59:59');
    if (payment) query = query.eq('payment', payment);
    query = query.order('date', { ascending: false }).limit(+(limit || 200));

    const { data, error } = await query;
    if (error) throw error;
    return apiOk(data);
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

    const { data: item, error: invErr } = await db.from('inventory').select('stock,buy_price').eq('id', item_id).single();
    if (invErr || !item) return apiError('Part nahi mila', 404);
    if (Number(item.stock) < +qty) return apiError(`Sirf ${item.stock} stock bacha hai`);

    // Deduct stock
    const { error: stockErr } = await db.from('inventory').update({ stock: item.stock - +qty }).eq('id', item_id);
    if (stockErr) throw stockErr;

    // Insert sale
    const { data: sale, error: saleErr } = await db.from('sales').insert({
      item_id, item_name: item_name.trim(), qty: +qty, amount: +amount,
      buy_price: item.buy_price, payment,
      customer: customer?.trim() || 'Walk-in',
      phone: phone?.trim() || '',
      udhaar_paid: payment !== 'udhaar',
      notes: notes?.trim() || '',
    }).select().single();
    if (saleErr) throw saleErr;

    const belowCost = (+amount / +qty) < Number(item.buy_price);
    return apiOk({ id: sale.id, belowCost }, 201);
  } catch (e) {
    console.error('[POST /api/sales]', e);
    return apiError('Sale save karne mein error', 500);
  }
}
