import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

declare global { var _supabase: ReturnType<typeof createClient> | undefined; }

const db = global._supabase ?? createClient(url, key);
if (process.env.NODE_ENV !== 'production') global._supabase = db;

export async function initDb() {
  // Tables are created via Supabase dashboard SQL editor
  // Run the SQL from /lib/schema.sql in Supabase SQL editor
}

export default db;
