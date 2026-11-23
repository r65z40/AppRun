// E-mails des comptes lecteurs (confirmation d'inscription, mot de passe oublié) réglés dans le back office,
// page Personnalisation > E-mails. Supabase envoie ces e-mails : on lui transmet l'expéditeur et les modèles
// par son API de gestion, seulement quand quelque chose a changé. Tourne avec la Dernière minute (toutes les 20 min).
// Il faut le secret GitHub SUPABASE_ACCESS_TOKEN (déjà demandé pour Premium) et la variable SUPABASE_URL.
import { createHash } from 'node:crypto';
import './settings.js';
import { pool, q } from './db.js';
import { brand, linkUrls, MAIL_DEFAULTS, toTemplate } from './mail-template.js';

const env = (k: string) => (process.env[k] ?? '').trim();

/** Ce qu'on envoie à Supabase : modèles en français (ceux du back office, sinon ceux par défaut), expéditeur si complet. */
export function authPatch(): Record<string, string> {
  const b = brand();
  const p: Record<string, string> = {};
  const val = (k: keyof typeof MAIL_DEFAULTS) => env(k) || MAIL_DEFAULTS[k];
  const sub = (k: keyof typeof MAIL_DEFAULTS) => val(k).replaceAll('{nom}', b.name);
  p.mailer_subjects_confirmation = sub('MAIL_CONFIRM_SUBJECT');
  p.mailer_templates_confirmation_content = toTemplate(val('MAIL_CONFIRM_BODY'), 'Activer mon compte', b);
  p.mailer_subjects_recovery = sub('MAIL_RESET_SUBJECT');
  p.mailer_templates_recovery_content = toTemplate(val('MAIL_RESET_BODY'), 'Choisir un nouveau mot de passe', b);
  // Expéditeur personnalisé : Supabase demande un serveur d'envoi (SMTP) complet.
  if (env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS_KEY') && env('MAIL_SENDER_EMAIL')) {
    Object.assign(p, {
      smtp_host: env('SMTP_HOST'),
      smtp_port: env('SMTP_PORT') || '587',
      smtp_user: env('SMTP_USER'),
      smtp_pass: env('SMTP_PASS_KEY'),
      smtp_admin_email: env('MAIL_SENDER_EMAIL'),
      smtp_sender_name: env('MAIL_SENDER_NAME') || b.name,
    });
  }
  return p;
}

async function save(state: Record<string, unknown>) {
  await q(`insert into public.app_settings (key, value) values ('MAIL_SYNCED', $1)
           on conflict (key) do update set value = excluded.value, updated_at = now()`, [JSON.stringify(state)]);
}

async function main() {
  const patch = authPatch();
  const token = env('SUPABASE_ACCESS_TOKEN');
  const ref = env('SUPABASE_URL').match(/^https?:\/\/([^.]+)\./)?.[1];
  const urls = linkUrls(env('PAGES_URL'));
  // Sans ces adresses autorisées, Supabase renverrait les liens des e-mails vers « localhost » : on les ajoute à sa liste.
  if (token && ref && urls.length) {
    const cur = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null) as { site_url?: string; uri_allow_list?: string } | null;
    if (cur) {
      const list = (cur.uri_allow_list ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      patch.uri_allow_list = [...new Set([...list, ...urls])].join(',');
      if (!cur.site_url || /localhost|127\.0\.0\.1/.test(cur.site_url)) patch.site_url = urls[0];
    }
  }
  const hash = createHash('sha256').update(JSON.stringify(patch)).digest('hex').slice(0, 16);
  let prev: { hash?: string; ok?: boolean } = {};
  try { prev = JSON.parse(env('MAIL_SYNCED') || '{}'); } catch {}
  if (prev.hash === hash && prev.ok) return console.log('E-mails : déjà à jour.');
  if (!token || !ref) {
    await save({ hash, ok: false, at: new Date().toISOString(), error: 'Secret SUPABASE_ACCESS_TOKEN ou variable SUPABASE_URL manquant dans GitHub.' });
    return console.log('E-mails : SUPABASE_ACCESS_TOKEN ou SUPABASE_URL manquant, réglages pas encore appliqués.');
  }
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const msg = (await r.text()).slice(0, 300);
    await save({ hash, ok: false, at: new Date().toISOString(), error: `Supabase a refusé (${r.status}) : ${msg}` });
    return console.log(`E-mails : refusé par Supabase (${r.status}) ${msg}`);
  }
  await save({ hash, ok: true, at: new Date().toISOString(), smtp: !!patch.smtp_host });
  console.log('E-mails : modèles, expéditeur et adresses de retour appliqués dans Supabase.');
}

if (process.argv[1]?.endsWith('mail.ts')) {
  main().catch((e) => console.log('E-mails :', e instanceof Error ? e.message : e)).finally(() => pool.end());
}
