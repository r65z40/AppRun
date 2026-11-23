// Modèles d'e-mails : texte simple du back office -> HTML pour Supabase. Sans effet de bord (testable seul).
const env = (k: string) => (process.env[k] ?? '').trim();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Brand = { name?: string; colors?: { violet?: string; night?: string } };
export function brand(): { name: string; accent: string } {
  let b: Brand = {};
  try { b = JSON.parse(env('BRAND') || '{}'); } catch {}
  const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
  return { name: (b.name || 'TITRE').slice(0, 40), accent: hex(b.colors?.violet, '#7B5CFF') };
}

/** Texte simple du back office -> HTML : {lien} devient un bouton, {nom} le nom de l'app, {email} l'adresse du lecteur. */
export function toTemplate(body: string, button: string, b = brand()): string {
  const fill = (s: string) => s.replaceAll('{nom}', esc(b.name)).replaceAll('{email}', '{{ .Email }}');
  if (/<[a-z]/i.test(body)) return fill(body).replaceAll('{lien}', '{{ .ConfirmationURL }}');
  const btn = `<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:${b.accent};color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">${esc(button)}</a></p>`;
  const paras = esc(body).split(/\n{2,}/).map((p) => (p.trim() === '{lien}' ? btn : `<p>${fill(p).replaceAll('{lien}', '<a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>').replace(/\n/g, '<br>')}</p>`));
  if (!body.includes('{lien}')) paras.push(btn);
  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1a1530;max-width:520px">${paras.join('')}</div>`;
}

