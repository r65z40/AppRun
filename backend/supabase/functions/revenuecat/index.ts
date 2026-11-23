// Webhook RevenueCat → base TITRE. RevenueCat prévient ici à chaque achat, renouvellement,
// résiliation, remboursement ou expiration ; la base met Premium à jour (fonction apply_store_event).
// Déployé par le workflow « Premium : webhook RevenueCat » (Actions). Secrets lus ici :
//   REVENUECAT_WEBHOOK_SECRET : la même valeur que « Authorization header » dans RevenueCat > Integrations > Webhooks.
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY : fournis automatiquement par Supabase.
declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Response | Promise<Response>): void };

const SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
const URL = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Comparaison à durée constante, pour ne rien laisser deviner du secret.
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'POST attendu' });
  const auth = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!SECRET || !same(auth, SECRET)) return reply(401, { error: 'Secret invalide' });
  const body = await req.json().catch(() => null) as { event?: Record<string, unknown> } | null;
  if (!body?.event) return reply(400, { error: 'Événement manquant' });
  const r = await fetch(`${URL}/rest/v1/rpc/apply_store_event`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ev: body.event }),
  });
  const out = await r.text();
  // Une erreur renvoie 500 : RevenueCat réessaie plus tard tout seul.
  if (!r.ok) { console.error('apply_store_event', r.status, out); return reply(500, { error: 'Base indisponible' }); }
  return reply(200, { ok: true, result: JSON.parse(out) });
});
