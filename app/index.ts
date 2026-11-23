import { registerRootComponent } from 'expo';

import Boot from './Boot';

// registerRootComponent calls AppRegistry.registerComponent('main', () => Boot);
// Boot applique la personnalisation du back office, puis charge l'app (App.tsx).
registerRootComponent(Boot);
