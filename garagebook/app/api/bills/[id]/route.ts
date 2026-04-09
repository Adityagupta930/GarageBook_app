import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { apiError, apiOk } from '@/lib/utils';

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { data: bill, error } = await db.from('bills').select('*').eq('id', id).single();
    if (error || !bill) return apiError('Bill nahi mila', 404);
    const { data: items } = await db.from('bill_items').select('*').eq('bill_id', id);
    return apiOk({ ...bill, items: items || [] });
  } catch (e) {
    console.error('[GET /api/bills/:id]', e);
    return apiError('Bill fetch nahi hua', 500);
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { error } = await db.from('bills').delete().eq('id', id);
    if (error) throw error;
    return apiOk({ success: true });
  } catch (e) {
    console.error('[DELETE /api/bills/:id]', e);
    return apiError('Bill delete nahi hua', 500);
  }
}
