// Auth-Hilfsfunktionen, laufen sowohl in Middleware (Edge) als auch in API-Routes (Node) via Web Crypto.

const encoder = new TextEncoder();

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Zeitkonstanter Vergleich statt `===`, um Timing-Angriffe zu vermeiden
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
