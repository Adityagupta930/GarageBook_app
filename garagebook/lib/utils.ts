// ── Shared (client + server) ─────────────────────────────────────

export const fmtCurrency = (n: number | null | undefined) => `₹${(n ?? 0).toFixed(2)}`;

/** Smart search — supports:
 * - Exact substring: "oil"
 * - Multi-word: "oil cast" → matches "Oil Castrol"
 * - Typo tolerance: "brek" → matches "break"
 * - SKU/company match
 * Returns a score (higher = better match), 0 = no match
 */
export function fuzzyMatch(str: string, query: string): boolean {
  if (!query.trim()) return true;
  const s = str.toLowerCase();
  const q = query.toLowerCase().trim();

  // 1. Direct substring match (fastest)
  if (s.includes(q)) return true;

  // 2. All words must appear somewhere in str
  const words = q.split(/\s+/);
  if (words.length > 1) {
    return words.every(w => s.includes(w));
  }

  // 3. Starts-with match on any word in str
  const strWords = s.split(/[\s\-\/]+/);
  if (strWords.some(sw => sw.startsWith(q))) return true;

  // 4. Typo tolerance — allow 1 char difference for queries >= 3 chars
  if (q.length >= 3) {
    for (const sw of strWords) {
      if (Math.abs(sw.length - q.length) <= 2 && editDistance(sw, q) <= 1) return true;
    }
  }

  // 5. Fuzzy char sequence (original fallback)
  let si = 0;
  for (let qi = 0; qi < q.length; qi++) {
    si = s.indexOf(q[qi], si);
    if (si === -1) return false;
    si++;
  }
  return true;
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

export const todayStr = () => new Date().toLocaleDateString('en-CA');

/** Format ISO/SQLite datetime string → DD/MM/YYYY */
export const fmtDate = (iso: string) => {
  // SQLite stores as "YYYY-MM-DD HH:MM:SS" — safe to split
  const d = iso.includes('T') ? new Date(iso) : new Date(iso.replace(' ', 'T'));
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

// ── Server-only ──────────────────────────────────────────────────

export function apiError(msg: string, status = 400) {
  return Response.json({ error: msg }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return Response.json(data, { status });
}
