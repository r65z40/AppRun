// Modèle d'e-mail : {lien} devient un bouton, {nom} le nom de l'app, {email} l'adresse du lecteur.
import { linkUrls, toTemplate } from '../src/mail-template.js';

const h = toTemplate('Bonjour {email},\n\nBienvenue sur {nom}.\n\n{lien}', 'Activer', { name: 'Brief', accent: '#E0457B' });
const ok = h.includes('{{ .ConfirmationURL }}') && h.includes('{{ .Email }}') && h.includes('Brief') && h.includes('#E0457B') && !h.includes('{lien}');
const x = toTemplate('<p>Salut</p>', 'x', { name: '<b>', accent: '#000000' });
console.log(ok && x === '<p>Salut</p>' ? "OK  modèle d'e-mail : bouton, nom et adresse remplacés" : `ÉCHEC  modèle d'e-mail : ${h}`);
const u = linkUrls('https://r65z40.github.io/AppRun');
console.log(u.join(',') === 'https://r65z40.github.io/AppRun/,https://r65z40.github.io/AppRun/**,https://r65z40.github.io/AppRun/admin/,https://r65z40.github.io/AppRun/admin/**' && linkUrls('').length === 0
  ? "OK  liens des e-mails : retour autorisé vers l'app web et le back office" : `ÉCHEC  adresses de retour : ${u}`);
