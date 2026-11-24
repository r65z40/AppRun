// Garde-fous de publication : ton neutre, chiffres présents dans les dépêches (règles gratuites, sans IA).
import { guardText, type Item } from '../src/ai.js';

const items: Item[] = [{ n: 1, source: 'Le Monde', title: 'Le Smic augmente de 2,5 % au 1er janvier', description: 'La hausse concerne 3 100 000 salariés.', publishedAt: null }];
const clean = guardText(['Le Smic augmente de <b>2,5 %</b> le 1er janvier', 'Hausse pour <b>3 100 000</b> salariés'], items);
const loaded = guardText(['Hausse scandaleuse du Smic !'], items);
const invented = guardText(['Le Smic augmente de <b>4 %</b> pour 12 millions de salariés'], items);
console.log(!clean.length ? 'OK  garde-fous : carte neutre et chiffres sourcés acceptés' : `ÉCHEC  garde-fous trop sévères : ${clean}`);
console.log(loaded.some((i) => i.includes('scandaleuse')) && loaded.some((i) => i.includes('exclamation')) ? 'OK  garde-fous : mot sensationnel et point d’exclamation repérés' : `ÉCHEC  ton : ${loaded}`);
console.log(invented.some((i) => i.startsWith('chiffre absent') && i.includes('12')) ? 'OK  garde-fous : chiffre absent des sources repéré' : `ÉCHEC  chiffres : ${invented}`);

// Anti-boucle : au-delà du plafond d'appels, le passage s'arrête proprement.
import { AiStopped, budget, usage } from '../src/ai.js';
usage.calls = 1000;
const stop = await budget.check().then(() => null, (e) => e);
console.log(stop instanceof AiStopped && /boucle/.test(stop.message) ? "OK  anti-boucle : passage arrêté au-delà de 200 appels à l'IA" : `ÉCHEC  anti-boucle : ${stop}`);
usage.calls = 0;

// « Voir les angles » : un angle par média, sources valables, au moins 2 sinon rien.
import { cleanAngles, type CardOut } from '../src/ai.js';
const two: Item[] = [items[0], { n: 2, source: 'Le Figaro', title: 'Smic', description: '', publishedAt: null }];
const card = (angles: CardOut['angles']) => ({ angles }) as CardOut;
const ok2 = cleanAngles(card([{ item_number: 1, text: 'Insiste sur le pouvoir d’achat' }, { item_number: 2, text: 'Insiste sur le coût pour les entreprises' }, { item_number: 2, text: 'doublon' }, { item_number: 9, text: 'source inconnue' }]), two);
const one = cleanAngles(card([{ item_number: 1, text: 'Seul angle' }]), two);
console.log(ok2?.length === 2 && ok2[1].source === 'Le Figaro' && one === null ? 'OK  angles des médias : un par média, au moins 2, sinon rien' : `ÉCHEC  angles : ${JSON.stringify([ok2, one])}`);

// Faits : ceux qui répètent le titre ou la phrase clé sont retirés (exemple réel du budget 2027).
import { cleanFacts } from '../src/ai.js';
const budget27 = {
  title: 'Budget 2027 : Lecornu écrit aux parlementaires',
  key_sentence: "Le Premier ministre propose cinq thèmes de compromis aux parlementaires pour le budget 2027, faute de majorité à l'Assemblée.",
  facts: [
    { item_number: 1, text: 'Sébastien Lecornu a envoyé une lettre aux <b>parlementaires</b> pour chercher un compromis.' },
    { item_number: 1, text: 'Il propose <b>cinq thèmes</b> de compromis, selon Ouest-France.' },
    { item_number: 1, text: "Les projets de budget de l'État et de la Sécurité sociale ont été <b>rejetés</b> à l'Assemblée." },
  ],
} as CardOut;
const kept = cleanFacts(budget27);
console.log(kept.length === 1 && kept[0].text.includes('rejetés') ? 'OK  faits : les faits qui répètent le titre ou la phrase clé sont retirés' : `ÉCHEC  faits : ${JSON.stringify(kept)}`);
