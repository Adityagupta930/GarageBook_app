import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { apiError, apiOk } from '@/lib/utils';

export async function GET() {
  try {
    const { data, error } = await db.from('customers').select('*').order('name');
    if (error) throw error;
    return apiOk(data);
  } catch (e) {
    console.error('[GET /api/customers]', e);
    return apiError('Customers fetch karne mein error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, phone, address } = await req.json();
    if (!name?.trim()) return apiError('Customer naam zaroori hai');

    const { data: exists } = await db.from('customers')
      .select('id').eq('name', name.trim()).eq('phone', phone || '').maybeSingle();
    if (exists) return apiError('Customer pehle se exist karta hai', 409);

    const { data, error } = await db.from('customers').insert({
      name: name.trim(), phone: phone?.trim() || '', address: address?.trim() || '',
    }).select().single();
    if (error) throw error;
    return apiOk(data, 201);
  } catch (e) {
    console.error('[POST /api/customers]', e);
    return apiError('Customer add karne mein error', 500);
  }
}
