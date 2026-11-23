// Modèle d'e-mail : {lien} devient un bouton, {nom} le nom de l'app, {email} l'adresse du lecteur.
import { toTemplate } from '../src/mail-template.js';

const h = toTemplate('Bonjour {email},\n\nBienvenue sur {nom}.\n\n{lien}', 'Activer', { name: 'Brief', accent: '#E0457B' });
const ok = h.includes('{{ .ConfirmationURL }}') && h.includes('{{ .Email }}') && h.includes('Brief') && h.includes('#E0457B') && !h.includes('{lien}');
const x = toTemplate('<p>Salut</p>', 'x', { name: '<b>', accent: '#000000' });
console.log(ok && x === '<p>Salut</p>' ? "OK  modèle d'e-mail : bouton, nom et adresse remplacés" : `ÉCHEC  modèle d'e-mail : ${h}`);
