// Refus de la fouille par l'IA : robots.txt (Disallow: / pour un robot d'IA) et tdmrep.json.
import { aiBotsBlocked, tdmReserved } from '../src/tdm.js';

const robots = `User-agent: *\nDisallow: /recherche\n\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /archives\n\nUser-agent: Googlebot\nDisallow: /`;
const b = aiBotsBlocked(robots).sort().join(',');
console.log(b === 'claudebot,gptbot' ? 'OK  robots.txt : robots d’IA interdits repérés' : `ÉCHEC  robots.txt : ${b}`);
const t = tdmReserved('[{"location":"/","tdm-reservation":1}]') && !tdmReserved('[{"location":"/blog/*","tdm-reservation":1}]') && !tdmReserved('pas du json');
console.log(t ? 'OK  tdmrep.json : réserve TDM repérée' : 'ÉCHEC  tdmrep.json');
