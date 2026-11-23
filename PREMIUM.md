# TITRE Premium : mettre en route les abonnements

Premium retire toutes les pubs et ajoute le badge Premium à côté du pseudo. Il s'achète dans l'app iPhone ou Android
(achats intégrés Apple et Google, via **RevenueCat**), se gagne avec un **code promo**, ou s'offre depuis le back office.

Tant que rien n'est configuré, tout fonctionne déjà : le back office (page **Abonnements**) permet d'offrir Premium et de
créer des codes, et l'app les accepte. Seul le paiement attend les étapes ci-dessous.

## Ce qui est déjà fait dans le code
- Base (migration `0014_premium.sql`, installée toute seule) : offres, abonnements, historique des paiements, codes promo.
  `profiles.premium` est recalculé tout seul ; le moteur éteint les abonnements arrivés à échéance toutes les 20 minutes.
- Fonction Supabase `revenuecat` : reçoit les achats, renouvellements, résiliations, remboursements et expirations.
- App : volet Premium (offres, essai gratuit, achat, « Restaurer mes achats », « J'ai un code », gestion de l'abonnement).
- Back office › Abonnements : chiffres clés, abonnés (offrir, prolonger, retirer), offres, codes promo, historique.

## À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### 1. Les stores
- **Apple** (compte développeur, 99 $/an) : App Store Connect › votre app › Abonnements › créer un groupe « TITRE Premium »
  avec deux produits : `titre_premium_mensuel` (2,99 €) et `titre_premium_annuel` (24,99 €), essai gratuit de 7 jours.
  Remplir aussi l'accord « Apps payantes » (coordonnées bancaires et fiscales).
- **Google** (compte développeur, 25 $ une fois) : Play Console › Monétiser › Abonnements › un abonnement `titre_premium`
  avec deux offres de base : `mensuel` et `annuel`, essai gratuit de 7 jours.

Les identifiants peuvent être différents : il suffit de recopier les vôtres dans le back office › Abonnements › Offres.

### 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois)
1. Créer un compte sur revenuecat.com, puis un projet « TITRE » avec une app iOS et une app Android reliées aux stores.
2. Produits : importer les produits des deux stores.
3. Entitlements : créer `premium` et y attacher tous les produits.
4. Offerings : l'offering par défaut contient les paquets Mensuel et Annuel.
5. Récupérer les deux **clés publiques SDK** (Project settings › API keys) : une `appl_…` et une `goog_…`.

### 3. Le webhook (RevenueCat prévient la base)
1. Dans GitHub › Settings › Secrets and variables › Actions, ajouter deux secrets :
   - `SUPABASE_ACCESS_TOKEN` : Supabase › Account › Access Tokens › Generate new token ;
   - `REVENUECAT_WEBHOOK_SECRET` : une longue phrase au hasard (gardez-la).
2. Actions › « Premium : webhook RevenueCat » › Run workflow. À la fin, il affiche l'adresse du webhook :
   `https://<projet>.supabase.co/functions/v1/revenuecat`.
3. RevenueCat › Integrations › Webhooks › Add : coller cette adresse, et dans « Authorization header value » la même phrase
   que `REVENUECAT_WEBHOOK_SECRET`. Bouton « Send test event » : une ligne « Test » apparaît dans Abonnements › Historique.

### 4. L'app
Ajouter aux variables du build (EAS ou fichier `.env` de l'app) :
```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_…
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_…
EXPO_PUBLIC_TERMS_URL=https://…/conditions      # Apple exige ces deux liens sous l'offre
EXPO_PUBLIC_PRIVACY_URL=https://…/confidentialite
```
Les achats intégrés ne marchent pas dans Expo Go : il faut un build de développement ou TestFlight (`npx eas build`).
Pour tester sans payer : comptes « Sandbox » d'App Store Connect, testeurs de licence de la Play Console. Ces achats de
test apparaissent dans le back office avec la mention « test » et ne comptent jamais dans les revenus.

## Bon à savoir
- Le prix réellement encaissé est celui réglé dans les stores. Celui du back office sert à l'affichage de secours et aux
  estimations. Apple et Google prélèvent 15 % (petits éditeurs, après demande) à 30 %.
- Résilier ou se faire rembourser se fait chez Apple ou Google : le lecteur garde Premium jusqu'à l'échéance, puis la base
  l'éteint toute seule. « Retirer » dans le back office coupe l'accès tout de suite mais n'arrête pas les prélèvements.
- Premium est lié au compte TITRE : le lecteur doit être connecté pour s'abonner, et le retrouve sur tous ses appareils.
