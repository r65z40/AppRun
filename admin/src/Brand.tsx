// Personnalisation de l'app : identité (nom, logo, couleurs, police), textes, notification du matin, e-mails des comptes.
// L'app lit ces réglages à chaque ouverture (app_config) ; les e-mails partent dans Supabase toutes les 20 minutes (backend/src/mail.ts).
import { useEffect, useState } from 'react';
import { api, type Setting } from './data';

// Mêmes valeurs par défaut que dans l'app (app/src/brand.ts et app/src/theme.ts).
const COLORS: [string, string, string][] = [
  ['night', 'Fond', '#0E0B1F'],
  ['violet', 'Couleur principale', '#7B5CFF'],
  ['blue', 'Couleur secondaire', '#3D7BFF'],
  ['pink', 'Accent (dégradés)', '#C86BFA'],
  ['coral', 'Alerte (Dernière minute)', '#FF6B8A'],
];
const FONTS: [string, string][] = [['archivo', 'Archivo'], ['inter', 'Inter'], ['dm-sans', 'DM Sans'], ['outfit', 'Outfit'], ['manrope', 'Manrope'], ['plus-jakarta-sans', 'Plus Jakarta Sans']];
const FONT_CSS: Record<string, string> = { archivo: 'Archivo', inter: 'Inter', 'dm-sans': 'DM Sans', outfit: 'Outfit', manrope: 'Manrope', 'plus-jakarta-sans': 'Plus Jakarta Sans' };
const TEXTS: [string, string, string, number][] = [
  ['welcome_title', 'Accueil : titre', "L'actu ultra résumée.", 60],
  ['welcome_text', 'Accueil : phrase', "Tout ce que vous devez savoir, sur ce qui vous intéresse. Avec 80 % de temps en moins qu'un média classique.", 200],
  ['notif_title', 'Présentation de la notification : titre', 'Votre édition, chaque matin.', 60],
  ['notif_text', 'Présentation de la notification : phrase', "Une seule notification par jour, quand l'édition est prête. Rien d'autre.", 200],
  ['ads_title', 'Présentation des pubs : titre', 'Gratuit, grâce à quelques pubs.', 60],
  ['ads_text', 'Présentation des pubs : phrase', "Une carte sponsorisée de temps en temps, jamais plus d'une toutes les six infos. Premium les retire toutes.", 200],
  ['end_title', 'Fin de journée : titre', "C'est tout pour aujourd'hui.", 60],
  ['end_bye', 'Fin de journée : au revoir', 'À demain.', 30],
  ['premium_pitch', 'Premium : phrase d’accroche', 'L’actu qui compte, sans aucune interruption.', 120],
];
const NOTIF_DEF = { enabled: true, default_time: '7 h 30', title: 'Votre édition est prête', body: '{n} infos pour être à jour, en quelques minutes.' };
const MAIL_DEF = {
  MAIL_CONFIRM_SUBJECT: 'Bienvenue sur {nom} : activez votre compte',
  MAIL_CONFIRM_BODY: 'Bonjour,\n\nMerci de rejoindre {nom}. Touchez le bouton ci-dessous pour activer votre compte.\n\n{lien}\n\nSi vous n’êtes pas à l’origine de cette inscription, ignorez ce message.',
  MAIL_RESET_SUBJECT: '{nom} : choisir un nouveau mot de passe',
  MAIL_RESET_BODY: 'Bonjour,\n\nVous avez demandé à changer votre mot de passe {nom}. Touchez le bouton ci-dessous pour en choisir un nouveau.\n\n{lien}\n\nSi vous n’avez rien demandé, ignorez ce message : votre mot de passe reste le même.',
};
const TIMES = Array.from({ length: 13 }, (_, i) => { const m = 360 + i * 30; return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; });

type Brand = { name: string; logo: string; font: string; colors: Record<string, string> };
type Notif = typeof NOTIF_DEF;
type Tab = 'identity' | 'texts' | 'notif' | 'mail';
const TABS: [Tab, string][] = [['identity', 'Identité'], ['texts', 'Textes de l’app'], ['notif', 'Notification'], ['mail', 'E-mails']];
const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
const parse = <T,>(v: string, d: T): T => { try { return v ? { ...d, ...JSON.parse(v) } : d; } catch { return d; } };

export function BrandPage({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<Setting[] | null>(null);
  const [tab, setTab] = useState<Tab>('identity');
  const load = () => api.settings().then(setList).catch((e) => { setList([]); say(e instanceof Error ? e.message : 'Lecture impossible'); });
  useEffect(() => { load(); }, []);
  const get = (k: string) => list?.find((s) => s.key === k)?.value ?? '';
  const save = async (k: string, v: string, msg = 'Enregistré : visible dans l’app à la prochaine ouverture') => {
    try { await api.setSetting(k, v); await load(); say(msg); return true; } catch (e) { say(e instanceof Error ? e.message : 'Enregistrement impossible'); return false; }
  };
  if (!list) return <p className="muted">Chargement…</p>;
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Personnalisation</div>
          <h1>L’app à votre image</h1>
          <p className="muted">Nom, logo, couleurs, police, textes, notification du matin et e-mails. L’app lit ces réglages à chaque ouverture : pas besoin de nouvelle version sur les stores. Un champ laissé vide garde la valeur d’origine.</p>
        </div>
      </header>
      <div className="tabs">{TABS.map(([t, l]) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{l}</button>)}</div>
      {tab === 'identity' ? <Identity key={get('BRAND')} raw={get('BRAND')} texts={parse(get('APP_TEXTS'), {} as Record<string, string>)} save={save} say={say} /> : null}
      {tab === 'texts' ? <Texts key={get('APP_TEXTS')} raw={get('APP_TEXTS')} save={save} /> : null}
      {tab === 'notif' ? <NotifTab key={get('NOTIFICATIONS')} raw={get('NOTIFICATIONS')} brand={parse(get('BRAND'), { name: 'TITRE' } as Brand).name || 'TITRE'} save={save} /> : null}
      {tab === 'mail' ? <Mail get={get} save={save} /> : null}
    </>
  );
}

type Save = (k: string, v: string, msg?: string) => Promise<boolean>;

/* ---------- Identité ---------- */
function Identity({ raw, texts, save, say }: { raw: string; texts: Record<string, string>; save: Save; say: (m: string) => void }) {
  const init: Brand = parse(raw, { name: '', logo: '', font: 'archivo', colors: {} });
  const [b, setB] = useState<Brand>({ ...init, colors: { ...init.colors } });
  const [busy, setBusy] = useState(false);
  const col = (k: string) => (isHex(b.colors[k] ?? '') ? b.colors[k] : COLORS.find((c) => c[0] === k)![2]);
  const bad = Object.values(b.colors).some((v) => v && !isHex(v)) || (!!b.logo && !/^https:\/\//.test(b.logo));
  const changed = JSON.stringify(b) !== JSON.stringify(init);
  const clean = (): Brand => ({ name: b.name.trim(), logo: b.logo.trim(), font: b.font, colors: Object.fromEntries(Object.entries(b.colors).filter(([, v]) => isHex(v))) });
  return (
    <div className="brand-grid">
      <div>
        <section className="panel settings">
          <h2>Nom et logo</h2>
          <div className="setting">
            <div><b>Nom de l’app</b><p className="muted small">Écran de lancement, en-têtes, Premium, e-mails et notification. Le nom sous l’icône du téléphone, lui, change avec la prochaine version publiée sur les stores.</p></div>
            <input maxLength={40} placeholder="TITRE" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} aria-label="Nom de l’app" />
          </div>
          <div className="setting">
            <div><b>Logo</b><p className="muted small">Image carrée (PNG ou JPG, 512 × 512 conseillé). Remplace l’icône dessinée dans l’app. L’icône du téléphone et l’écran de démarrage système suivent à la prochaine version sur les stores.</p></div>
            <div className="setting-row">
              {b.logo ? <img src={b.logo} alt="" className="logo-prev" /> : null}
              <label className="btn">
                {busy ? 'Envoi…' : b.logo ? 'Changer' : 'Envoyer une image'}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  setBusy(true);
                  try { const url = await api.uploadPhoto(f); setB((x) => ({ ...x, logo: url })); } catch (err) { say(err instanceof Error ? err.message : 'Envoi impossible'); }
                  setBusy(false);
                }} />
              </label>
              {b.logo ? <button className="btn ghost" onClick={() => setB({ ...b, logo: '' })}>Retirer</button> : null}
            </div>
          </div>
        </section>
        <section className="panel settings">
          <h2>Couleurs</h2>
          {COLORS.map(([k, l, d]) => (
            <div className="setting" key={k}>
              <div><b>{l}</b><p className="muted small">Par défaut {d}{k === 'night' ? ' : gardez un fond sombre, les textes de l’app sont blancs.' : ''}</p></div>
              <div className="setting-row color-row">
                <input type="color" value={col(k)} onChange={(e) => setB({ ...b, colors: { ...b.colors, [k]: e.target.value } })} aria-label={l} />
                <input value={b.colors[k] ?? ''} placeholder={d} maxLength={7} onChange={(e) => setB({ ...b, colors: { ...b.colors, [k]: e.target.value.trim() } })} aria-label={`${l} (code)`} className={b.colors[k] && !isHex(b.colors[k]) ? 'invalid' : ''} />
                {b.colors[k] ? <button className="btn ghost sm" onClick={() => { const c = { ...b.colors }; delete c[k]; setB({ ...b, colors: c }); }}>Défaut</button> : null}
              </div>
            </div>
          ))}
        </section>
        <section className="panel settings">
          <h2>Police</h2>
          <div className="setting">
            <div><b>Police de l’app</b><p className="muted small">Une seule police, lisible, pour tout le texte. Archivo est intégrée ; les autres se téléchargent à la première ouverture (si le réseau manque, l’app garde Archivo).</p></div>
            <select value={b.font} onChange={(e) => setB({ ...b, font: e.target.value })} aria-label="Police">
              {FONTS.map(([v, l]) => <option key={v} value={v}>{l}{v === 'archivo' ? ' (par défaut)' : ''}</option>)}
            </select>
          </div>
        </section>
        <div className="setting-actions sticky-actions">
          <button className="btn ghost" disabled={!raw} onClick={() => save('BRAND', '', 'Identité d’origine rétablie')}>Revenir à l’identité d’origine</button>
          <button className="btn primary" disabled={!changed || bad} onClick={() => save('BRAND', JSON.stringify(clean()))}>{bad ? 'Corrigez les champs en rouge' : 'Enregistrer'}</button>
        </div>
      </div>
      <Preview name={b.name.trim() || 'TITRE'} logo={b.logo} font={FONT_CSS[b.font]} c={(k) => col(k)} title={texts.welcome_title || TEXTS[0][2]} text={texts.welcome_text || TEXTS[1][2]} />
    </div>
  );
}

function Preview({ name, logo, font, c, title, text }: { name: string; logo: string; font: string; c: (k: string) => string; title: string; text: string }) {
  const ff = `'${font}', Archivo, sans-serif`;
  return (
    <div className="brand-prev">
      {font !== 'Archivo' ? <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;800&display=swap`} /> : null}
      <div className="muted small">Aperçu</div>
      <div className="mini-phone" style={{ background: `linear-gradient(135deg, ${c('pink')}, ${c('violet')}, ${c('blue')})`, fontFamily: ff }}>
        {logo ? <img src={logo} alt="" /> : <div className="mini-icon" />}
        <b style={{ fontWeight: 800 }}>{name}</b>
      </div>
      <div className="mini-phone" style={{ background: `linear-gradient(180deg, ${c('violet')}55, ${c('night')} 60%)`, backgroundColor: c('night'), fontFamily: ff, justifyContent: 'flex-end', alignItems: 'stretch', textAlign: 'left' }}>
        <b style={{ fontSize: 20, fontWeight: 800 }}>{title}</b>
        <span style={{ fontSize: 12, opacity: 0.75 }}>{text}</span>
        <span className="mini-btn" style={{ background: `linear-gradient(90deg, ${c('violet')}, ${c('blue')})` }}>Commencer</span>
        <span className="mini-flash" style={{ background: c('coral') }}>Dernière minute</span>
      </div>
    </div>
  );
}

/* ---------- Textes ---------- */
function Texts({ raw, save }: { raw: string; save: Save }) {
  const init = parse(raw, {} as Record<string, string>);
  const [t, setT] = useState<Record<string, string>>(init);
  const clean = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  const changed = JSON.stringify(clean) !== JSON.stringify(init);
  return (
    <section className="panel settings">
      <h2>Textes de l’app</h2>
      <p className="muted small">Les phrases clés que voient les lecteurs. Champ vide = texte d’origine (affiché en gris).</p>
      {TEXTS.map(([k, l, d, max]) => (
        <div className="setting column" key={k}>
          <div><b>{l}</b></div>
          {max > 80
            ? <textarea rows={2} maxLength={max} placeholder={d} value={t[k] ?? ''} onChange={(e) => setT({ ...t, [k]: e.target.value })} aria-label={l} />
            : <input maxLength={max} placeholder={d} value={t[k] ?? ''} onChange={(e) => setT({ ...t, [k]: e.target.value })} aria-label={l} />}
        </div>
      ))}
      <div className="setting-actions">
        <button className="btn ghost" disabled={!raw} onClick={() => save('APP_TEXTS', '', 'Textes d’origine rétablis')}>Revenir aux textes d’origine</button>
        <button className="btn primary" disabled={!changed} onClick={() => save('APP_TEXTS', Object.keys(clean).length ? JSON.stringify(clean) : '')}>Enregistrer</button>
      </div>
    </section>
  );
}

/* ---------- Notification ---------- */
function NotifTab({ raw, brand, save }: { raw: string; brand: string; save: Save }) {
  const init: Notif = parse(raw, NOTIF_DEF);
  const [n, setN] = useState<Notif>(init);
  const changed = JSON.stringify(n) !== JSON.stringify(init);
  const body = (n.body || NOTIF_DEF.body).replaceAll('{n}', '8').replaceAll('{nom}', brand);
  return (
    <div className="brand-grid">
      <section className="panel settings">
        <h2>Notification du matin</h2>
        <label className="setting toggle">
          <div><b>Proposer la notification</b><p className="muted small">Coupée : l’app ne la propose plus et retire celle déjà prévue sur les téléphones, à leur prochaine ouverture.</p></div>
          <input type="checkbox" checked={n.enabled} onChange={(e) => setN({ ...n, enabled: e.target.checked })} />
        </label>
        <div className="setting">
          <div><b>Heure proposée</b><p className="muted small">L’heure cochée pour un nouveau lecteur. Chacun peut la changer dans ses réglages. L’édition est prête vers 6 h.</p></div>
          <select value={n.default_time} onChange={(e) => setN({ ...n, default_time: e.target.value })} aria-label="Heure proposée">
            {TIMES.map((t) => <option key={t} value={t}>{t}{t === NOTIF_DEF.default_time ? ' (par défaut)' : ''}</option>)}
          </select>
        </div>
        <div className="setting column">
          <div><b>Titre</b></div>
          <input maxLength={80} placeholder={NOTIF_DEF.title} value={n.title === NOTIF_DEF.title ? '' : n.title} onChange={(e) => setN({ ...n, title: e.target.value || NOTIF_DEF.title })} aria-label="Titre de la notification" />
        </div>
        <div className="setting column">
          <div><b>Texte</b><p className="muted small">{'{n}'} = nombre d’infos choisi par le lecteur, {'{nom}'} = nom de l’app. Le texte ne cite jamais une info précise : la notification est programmée sur le téléphone à l’avance, et ne peut donc pas afficher un sujet sensible.</p></div>
          <input maxLength={200} placeholder={NOTIF_DEF.body} value={n.body === NOTIF_DEF.body ? '' : n.body} onChange={(e) => setN({ ...n, body: e.target.value || NOTIF_DEF.body })} aria-label="Texte de la notification" />
        </div>
        <div className="setting-actions">
          <button className="btn ghost" disabled={!raw} onClick={() => save('NOTIFICATIONS', '', 'Notification d’origine rétablie')}>Revenir aux réglages d’origine</button>
          <button className="btn primary" disabled={!changed} onClick={() => save('NOTIFICATIONS', JSON.stringify(n))}>Enregistrer</button>
        </div>
      </section>
      <div className="brand-prev">
        <div className="muted small">Aperçu</div>
        <div className={`notif-prev ${n.enabled ? '' : 'off'}`}>
          <div className="notif-app"><span className="mini-icon sm" /> {brand.toUpperCase()} <span className="muted">· {n.default_time}</span></div>
          <b>{n.title || NOTIF_DEF.title}</b>
          <span>{body}</span>
        </div>
        {!n.enabled ? <p className="muted small">Notification coupée.</p> : null}
      </div>
    </div>
  );
}

/* ---------- E-mails ---------- */
function Mail({ get, save }: { get: (k: string) => string; save: Save }) {
  const keys = ['MAIL_SENDER_NAME', 'MAIL_SENDER_EMAIL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'MAIL_CONFIRM_SUBJECT', 'MAIL_CONFIRM_BODY', 'MAIL_RESET_SUBJECT', 'MAIL_RESET_BODY'] as const;
  const [d, setD] = useState<Record<string, string>>(() => Object.fromEntries(keys.map((k) => [k, get(k)])));
  const [pass, setPass] = useState('');
  const dirty = keys.filter((k) => (d[k] ?? '').trim() !== get(k));
  const sync = parse(get('MAIL_SYNCED'), {} as { ok?: boolean; at?: string; error?: string; smtp?: boolean });
  const smtpParts = [d.SMTP_HOST, d.SMTP_USER, d.MAIL_SENDER_EMAIL].filter((v) => v?.trim()).length + (get('SMTP_PASS_KEY') || pass ? 1 : 0);
  const saveAll = async () => {
    for (const k of dirty) if (!(await save(k, d[k] ?? '', 'E-mails enregistrés'))) return;
    if (pass.trim() && (await save('SMTP_PASS_KEY', pass, 'E-mails enregistrés'))) setPass('');
  };
  const field = (k: (typeof keys)[number], label: string, help: string, placeholder = '', type = 'text') => (
    <div className="setting">
      <div><b>{label}</b><p className="muted small">{help}</p></div>
      <input type={type} placeholder={placeholder} value={d[k] ?? ''} onChange={(e) => setD({ ...d, [k]: e.target.value })} aria-label={label} />
    </div>
  );
  const tpl = (s: 'CONFIRM' | 'RESET', title: string) => (
    <div className="setting column">
      <div><b>{title}</b><p className="muted small">{'{lien}'} devient un bouton, {'{nom}'} le nom de l’app, {'{email}'} l’adresse du lecteur. Texte simple : une ligne vide sépare les paragraphes. Vide = modèle actuel de Supabase (en anglais).</p></div>
      <input maxLength={200} placeholder={MAIL_DEF[`MAIL_${s}_SUBJECT`]} value={d[`MAIL_${s}_SUBJECT`] ?? ''} onChange={(e) => setD({ ...d, [`MAIL_${s}_SUBJECT`]: e.target.value })} aria-label={`${title} : objet`} />
      <textarea rows={7} maxLength={10000} placeholder={MAIL_DEF[`MAIL_${s}_BODY`]} value={d[`MAIL_${s}_BODY`] ?? ''} onChange={(e) => setD({ ...d, [`MAIL_${s}_BODY`]: e.target.value })} aria-label={`${title} : texte`} />
      {!d[`MAIL_${s}_BODY`] ? <div><button className="btn ghost sm" onClick={() => setD({ ...d, [`MAIL_${s}_SUBJECT`]: MAIL_DEF[`MAIL_${s}_SUBJECT`], [`MAIL_${s}_BODY`]: MAIL_DEF[`MAIL_${s}_BODY`] })}>Partir du modèle en français</button></div> : null}
    </div>
  );
  return (
    <>
      <div className={`status-bar ${sync.ok === false ? 'off' : ''}`}>
        <b>{sync.ok ? 'Appliqués dans Supabase' : sync.ok === false ? 'Pas encore appliqués' : 'E-mails d’origine de Supabase'}</b>
        <span className="muted small">{sync.ok ? `Le ${new Date(sync.at!).toLocaleString('fr-FR')}${sync.smtp ? ', avec votre expéditeur' : ''}. Une modification part dans les 20 minutes.` : sync.error ?? 'Vos réglages partent dans Supabase dans les 20 minutes après l’enregistrement (avec la Dernière minute).'}</span>
      </div>
      <section className="panel settings">
        <h2>Expéditeur</h2>
        <p className="muted small">Pour écrire depuis votre adresse (par exemple bonjour@votre-domaine.fr), Supabase demande un service d’envoi : Brevo, Resend ou celui de votre hébergeur vous donnent ces 4 informations. Sans lui, les e-mails partent de l’adresse de Supabase, limités à quelques envois par heure.</p>
        {field('MAIL_SENDER_NAME', 'Nom de l’expéditeur', 'Ce que le lecteur voit dans sa boîte. Vide = nom de l’app.', 'TITRE')}
        {field('MAIL_SENDER_EMAIL', 'Adresse de l’expéditeur', 'Elle doit être autorisée chez votre service d’envoi.', 'bonjour@votre-domaine.fr', 'email')}
        {field('SMTP_HOST', 'Serveur d’envoi (SMTP)', 'Exemple Brevo : smtp-relay.brevo.com', 'smtp-relay.brevo.com')}
        {field('SMTP_PORT', 'Port', '587 en général.', '587')}
        {field('SMTP_USER', 'Identifiant SMTP', 'Donné par votre service d’envoi.')}
        <div className="setting">
          <div><b>Mot de passe SMTP</b> {get('SMTP_PASS_KEY') ? <span className="pill published">Enregistré {get('SMTP_PASS_KEY')}</span> : <span className="pill rejected">Manquant</span>}<p className="muted small">Jamais réaffiché en clair.</p></div>
          <div className="setting-row">
            <input type="password" autoComplete="off" placeholder={get('SMTP_PASS_KEY') ? 'Nouveau mot de passe pour le remplacer' : 'Coller le mot de passe'} value={pass} onChange={(e) => setPass(e.target.value)} aria-label="Mot de passe SMTP" />
            {get('SMTP_PASS_KEY') ? <button className="btn ghost" onClick={() => save('SMTP_PASS_KEY', '', 'Mot de passe effacé')}>Effacer</button> : null}
          </div>
        </div>
        {smtpParts > 0 && smtpParts < 4 ? <p className="warn small">Il manque encore {4 - smtpParts} information(s) : l’expéditeur ne sera appliqué qu’une fois serveur, identifiant, mot de passe et adresse remplis.</p> : null}
      </section>
      <section className="panel settings">
        <h2>Modèles</h2>
        {tpl('CONFIRM', 'Confirmation d’inscription')}
        {tpl('RESET', 'Mot de passe oublié')}
      </section>
      <div className="setting-actions">
        <span className="muted small">Il faut le secret GitHub SUPABASE_ACCESS_TOKEN (le même que pour Premium).</span>
        <button className="btn primary" disabled={!dirty.length && !pass.trim()} onClick={saveAll}>Enregistrer</button>
      </div>
    </>
  );
}
