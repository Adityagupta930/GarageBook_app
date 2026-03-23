import { initDb } from '@/lib/db';

export async function GET() {
  await initDb();
  return Response.json({ ok: true });
}
