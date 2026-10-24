# OS Corsica Connect

Appli web (PWA) pour garder le lien avec notre collègue pendant ses 6 mois de road trip en Asie.

- **Groupe** : photos, messages, pokes (café, câlin, courage…), fiche pratique du pays visité, réception des alertes.
- **Voyageur** : un espace **Cartes postales** qui s'ouvre une fois par mois, réponses, bouton « Je vais bien » avec position, bouton **SOS** (appui long 3 s) avec repli SMS sans internet, numéros d'urgence par pays.

## Le courrier du mois

Les messages, photos et pokes du groupe restent sous enveloppe. Ils s'ouvrent tous ensemble le **1er du mois suivant, à 0 h UTC** (7 h au Vietnam, 1 h ou 2 h à Paris), et le voyageur reçoit une notification « Ton courrier est arrivé ». En attendant, il voit seulement combien de messages l'attendent.

La règle est appliquée par la base de données, pas seulement par l'écran. Seule exception : les réponses à une alerte SOS arrivent tout de suite.

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | Page de l'appli |
| `style.css`, `app.js` | Interface et logique |
| `config.js` | **Le seul fichier à modifier** : clés Supabase, clé VAPID publique, voyage, référents |
| `sw.js` | Service worker : hors-ligne et notifications |
| `manifest.webmanifest`, `icons/` | Installation sur l'écran d'accueil |
| `tools/vapid.html` | Génère les clés de notification dans le navigateur |
| `supabase/schema.sql` | Base de données, règles d'accès, stockage photos, codes d'invitation |
| `supabase/functions/send-push/index.ts` | Fonction qui envoie les notifications |
| `supabase/monthly.sql` | Tâche planifiée du 1er du mois (annonce du courrier) |

## Mode démo

Tant que `SUPABASE_URL` est vide dans `config.js`, l'appli tourne en mode démo avec des données d'exemple. On peut aussi forcer la démo en ajoutant `#demo` à l'adresse.

## Mise en route

Tout se fait depuis le navigateur, sans rien installer :

1. Créer un projet Supabase et exécuter `supabase/schema.sql` dans le SQL Editor (il affiche les deux codes d'invitation).
2. Activer **Anonymous sign-ins** (Authentication > Sign In / Providers).
3. Déposer ces fichiers sur GitHub et activer **GitHub Pages**.
4. Ouvrir `https://<compte>.github.io/<dépôt>/tools/vapid.html` et générer les clés.
5. Créer l'Edge Function `send-push` dans le tableau de bord Supabase, désactiver « Verify JWT », ajouter les secrets.
6. Créer un Database Webhook sur l'insertion dans `messages` vers la fonction, avec l'en-tête `x-webhook-secret`.
7. Remplir `config.js` sur GitHub.
8. Activer `pg_cron` et `pg_net` (Database > Extensions), puis exécuter `supabase/monthly.sql` après y avoir mis l'identifiant du projet et le secret.

Le guide détaillé pas à pas et la checklist avant le départ sont dans le document partagé « OS Corsica Connect – Guide de mise en route ».

## Limites à connaître

- L'appli **ne remplace pas les secours locaux** : le SOS prévient le groupe, il n'appelle personne.
- Sur Android, les notifications passent par les services Google : **en Chine, elles n'arrivent pas sans VPN**. Le fil reste consultable en ouvrant l'appli.
- Les numéros d'urgence sont à revérifier avant le départ sur diplomatie.gouv.fr.
