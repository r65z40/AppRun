// Installe la vraie app sur un iPhone branché à un Mac, avec un identifiant Apple gratuit.
// Lancer depuis le dossier app :  npm run iphone-gratuit
// Un compte Apple gratuit ne permet ni widget ni alertes push : on les retire de cette version.
// L'app s'arrête au bout de 7 jours : relancer la commande pour la réinstaller.
const fs = require('fs');
const { execSync } = require('child_process');

const original = fs.readFileSync('app.json', 'utf8');
const app = JSON.parse(original);
const name = (p) => (Array.isArray(p) ? p[0] : p);
app.expo.plugins = app.expo.plugins.filter((p) => !['expo-widgets', 'expo-notifications'].includes(name(p)));
// Identifiant à part : le vrai (fr.studio23.titre) reste libre pour le compte Apple payant.
app.expo.ios.bundleIdentifier += '.essai';

fs.writeFileSync('app.json', JSON.stringify(app, null, 2));
try {
  execSync('npx expo prebuild --platform ios --clean', { stdio: 'inherit' });
  execSync('npx expo run:ios --device --configuration Release', { stdio: 'inherit' });
} finally {
  fs.writeFileSync('app.json', original);
}
