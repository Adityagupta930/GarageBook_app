import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { apiError, apiOk } from '@/lib/utils';

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.execute({ sql: 'DELETE FROM customers WHERE id = ?', args: [+id] });
    return apiOk({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/customers/[id]]', e);
    return apiError('Delete nahi hua', 500);
  }
}
