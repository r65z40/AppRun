// Démarrage : la personnalisation du back office (couleurs, police, nom, textes) est appliquée
// avant d'importer les écrans, parce que leurs styles sont calculés une fois, à l'import.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { bootBrand } from './src/brand';
import { C } from './src/theme';

export default function Boot() {
  const [App, setApp] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    bootBrand().finally(() => import('./App').then((m) => setApp(() => m.default)));
  }, []);
  return App ? <App /> : <View style={{ flex: 1, backgroundColor: C.night }} />;
}
