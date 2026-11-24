/**
 * Le média refuse-t-il que l'IA lise ses textes (fouille de textes, article L122-5-3 du code de la propriété intellectuelle) ?
 * Deux signaux lisibles par une machine : robots.txt qui interdit tout le site aux robots d'IA, et le fichier
 * TDMRep (/.well-known/tdmrep.json) avec « tdm-reservation: 1 ». Les conditions d'utilisation écrites ne sont pas lues :
 * l'équipe doit les vérifier elle-même.
 */
const AI_BOTS = ['claudebot', 'anthropic-ai', 'claude-web', 'gptbot', 'chatgpt-user', 'oai-searchbot', 'google-extended', 'ccbot', 'perplexitybot', 'bytespider', 'applebot-extended', 'meta-externalagent', 'mistralai-user', 'cohere-ai'];

/** Robots d'IA à qui robots.txt interdit tout le site (« Disallow: / »). */
export function aiBotsBlocked(robots: string): string[] {
  const blocked = new Set<string>();
  let agents: string[] = [];
  let inRules = false;
  for (const raw of robots.split(/\r?\n/)) {
    const [k, ...rest] = raw.replace(/#.*/, '').split(':');
    const key = k.trim().toLowerCase(), val = rest.join(':').trim();
    if (key === 'user-agent') {
      if (inRules) { agents = []; inRules = false; }
      agents.push(val.toLowerCase());
    } else if (key === 'disallow' || key === 'allow') {
      inRules = true;
      if (key === 'disallow' && val === '/') agents.filter((a) => AI_BOTS.includes(a)).forEach((a) => blocked.add(a));
    }
  }
  return [...blocked];
}

/** Réservation TDMRep qui couvre tout le site. */
export function tdmReserved(json: string): boolean {
  try {
    const rules = JSON.parse(json);
    return Array.isArray(rules) && rules.some((r) => (r?.['tdm-reservation'] === 1 || r?.['tdm-reservation'] === '1') && /^\/\*?$/.test(r?.location ?? ''));
  } catch { return false; }
}

const get = (url: string) => fetch(url, { headers: { 'user-agent': 'TITRE-bot/0.2 (agrégateur de titres)' }, signal: AbortSignal.timeout(10000) })
  .then((r) => (r.ok ? r.text() : '')).catch(() => '');

/** Explication du refus en une phrase, ou null si aucun refus trouvé. Regarde le site du flux et le site principal (www.). */
export async function aiRefusal(feedUrl: string): Promise<string | null> {
  const host = new URL(feedUrl).hostname;
  const main = 'www.' + host.split('.').slice(-2).join('.');
  const found: string[] = [];
  for (const h of [...new Set([host, main])]) {
    const bots = aiBotsBlocked(await get(`https://${h}/robots.txt`));
    if (bots.length) found.push(`robots.txt de ${h} interdit ${bots.join(', ')}`);
    if (tdmReserved(await get(`https://${h}/.well-known/tdmrep.json`))) found.push(`${h} déclare une réserve TDM (tdmrep.json)`);
  }
  return found.length ? found.join(' ; ') : null;
}
