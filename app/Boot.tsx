// Démarrage : la personnalisation du back office (couleurs, police, nom, textes) est appliquée
// avant d'importer les écrans, parce que leurs styles sont calculés une fois, à l'import.
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { bootBrand } from './src/brand';
import { C } from './src/theme';

// Adresse publique des pages légales (demandée par les stores) : site web ?legal=privacy, terms ou notice.
const LEGAL = Platform.OS === 'web' && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('legal') : null;

export default function Boot() {
  const [App, setApp] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    bootBrand().finally(() => {
      if (LEGAL === 'privacy' || LEGAL === 'terms' || LEGAL === 'notice') {
        import('./src/Screens').then(({ Legal }) => setApp(() => () => <SafeAreaProvider><Legal page={LEGAL} /></SafeAreaProvider>));
      } else import('./App').then((m) => setApp(() => m.default));
    });
  }, []);
  return App ? <App /> : <View style={{ flex: 1, backgroundColor: C.night }} />;
}
