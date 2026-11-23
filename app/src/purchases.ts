// Achats intégrés (App Store, Google Play) via RevenueCat.
// RevenueCat encaisse et prévient la base (webhook) : c'est elle qui décide si le lecteur est Premium.
// Sans clé RevenueCat, sur le web ou dans Expo Go, l'achat est simplement indisponible.
import { Linking, Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

const KEY = Platform.select({ ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY });
/** Nom du droit (« entitlement ») créé dans RevenueCat. */
const ENTITLEMENT = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT || 'premium';
export const storeOn = Platform.OS !== 'web' && !!KEY;

type RC = typeof import('react-native-purchases').default;
let rc: RC | null = null;
let ready: Promise<RC | null> | null = null;
let uid: string | null = null;

/** Charge RevenueCat au premier besoin (le module natif n'existe pas sur le web). */
function sdk(): Promise<RC | null> {
  if (!storeOn) return Promise.resolve(null);
  if (!ready)
    ready = import('react-native-purchases')
      .then((m) => {
        rc = m.default;
        rc.configure({ apiKey: KEY!, appUserID: uid ?? undefined });
        return rc;
      })
      .catch(() => null);
  return ready;
}

const hasPremium = (c: CustomerInfo) => !!c.entitlements.active[ENTITLEMENT];

/** Relie les achats au compte TITRE : l'identifiant RevenueCat = l'identifiant du compte. */
export async function storeLogin(id: string | null) {
  if (!storeOn || id === uid) return;
  uid = id;
  const p = await sdk();
  if (!p) return;
  try {
    if (id) await p.logIn(id);
    else if (!(await p.isAnonymous())) await p.logOut();
  } catch {}
}

/** Prix affichés par le store (dans la monnaie du lecteur), par identifiant de produit. */
export async function storePrices(): Promise<Record<string, { price: string; pkg: PurchasesPackage }>> {
  const p = await sdk();
  if (!p) return {};
  try {
    const o = await p.getOfferings();
    const out: Record<string, { price: string; pkg: PurchasesPackage }> = {};
    for (const pkg of o.current?.availablePackages ?? []) {
      const id = pkg.product.identifier;
      out[id] = { price: pkg.product.priceString, pkg };
      out[id.split(':')[0]] = out[id.split(':')[0]] ?? out[id]; // Google : « abonnement:offre »
    }
    return out;
  } catch { return {}; }
}

export type BuyResult = 'ok' | 'cancel';

/** Achète un produit. Lève une erreur lisible si le store refuse. */
export async function buy(productId: string): Promise<BuyResult> {
  const p = await sdk();
  if (!p) throw new Error('Achat indisponible sur cet appareil.');
  const prices = await storePrices();
  const found = prices[productId] ?? prices[productId.split(':')[0]];
  if (!found) throw new Error('Cette offre n’est pas encore disponible dans le store.');
  try {
    const r = await p.purchasePackage(found.pkg);
    return hasPremium(r.customerInfo) ? 'ok' : 'cancel';
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) return 'cancel';
    throw new Error(err.message || 'Le paiement n’a pas abouti.');
  }
}

/** « Restaurer mes achats » : retrouve un abonnement pris avec le même compte Apple ou Google. */
export async function restore(): Promise<boolean> {
  const p = await sdk();
  if (!p) return false;
  return hasPremium(await p.restorePurchases());
}

/** Ouvre la page d'abonnements du store (résilier, changer d'offre). */
export async function manage() {
  const p = await sdk();
  try { if (p) return await p.showManageSubscriptions(); } catch {}
  Linking.openURL(Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions');
}
