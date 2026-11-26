import { registerRootComponent } from 'expo';
import { Alert } from 'react-native';

import Boot from './Boot';

// Dans la vraie app, une erreur imprévue ferme l'app d'un coup. On l'affiche plutôt (une fois toutes les 10 s) :
// l'app reste ouverte et la capture du message dit exactement quoi corriger.
const EU = (globalThis as { ErrorUtils?: { getGlobalHandler(): (e: unknown, fatal?: boolean) => void; setGlobalHandler(f: (e: unknown, fatal?: boolean) => void): void } }).ErrorUtils;
if (EU && !__DEV__) {
  let last = 0;
  EU.setGlobalHandler((e) => {
    if (Date.now() - last < 10000) return;
    last = Date.now();
    const err = e as { message?: string; stack?: string };
    Alert.alert('Petit souci', `${err?.message ?? String(e)}\n\n${(err?.stack ?? '').split('\n').slice(0, 4).join('\n')}\n\nFaites une capture de ce message.`);
  });
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Boot);
// Boot applique la personnalisation du back office, puis charge l'app (App.tsx).
registerRootComponent(Boot);
