# ROADTRIP

Appli web (PWA) qui accompagne Antoine pendant ses 6 mois de road trip en Asie, sans l'obliger à garder le contact.

Trois onglets, dans cet ordre :

1. **Pays** : l'essentiel sur le pays et l'étape en cours (décalage horaire, monnaie, prises, météo de saison, phrases utiles, savoir-vivre, santé, arnaques).
2. **Sécurité** (Urgence côté groupe) : bouton **SOS** (appui long 3 s) avec position et repli SMS sans internet, numéros d'urgence par pays, référents. Partage de position facultatif.
3. **Carte postale** : une fonction discrète. Le groupe y glisse des mots, des photos et des pokes ; le courrier arrive le 1er du mois et le voyageur l'ouvre quand il veut, ou jamais. Aucune réponse n'est attendue.

## Ce que l'appli n'impose pas

- Pas d'alerte « aucune nouvelle depuis X jours », pas d'indicateur d'activité.
- Notifications du voyageur désactivées par défaut : il choisit d'être prévenu ou non quand le courrier arrive.
- Le partage de position et l'écriture au groupe sont facultatifs.

## Le courrier du mois

Les envois du groupe sont distribués le **1er du mois suivant, à 0 h UTC** (7 h au Vietnam, 1 h ou 2 h à Paris). La règle est appliquée par la base de données, pas seulement par l'écran. Seule exception : les réponses à une alerte SOS arrivent tout de suite.

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
| `supabase/monthly.sql` | Tâche planifiée du 1er du mois |

## Mode démo

Tant que `SUPABASE_URL` est vide dans `config.js`, l'appli tourne en mode démo avec des données d'exemple. On peut aussi forcer la démo en ajoutant `#demo` à l'adresse.

## Mise en route

Tout se fait depuis le navigateur, sans rien installer :

1. Créer un projet Supabase et exécuter `supabase/schema.sql` dans le SQL Editor (il affiche les deux codes d'invitation).
2. Activer **Anonymous sign-ins** (Authentication > Sign In / Providers).
3. Déposer ces fichiers sur GitHub (dépôt public `roadtrip`) et activer **GitHub Pages**.
4. Ouvrir `https://<compte>.github.io/roadtrip/tools/vapid.html` et générer les clés.
5. Créer l'Edge Function `send-push` dans le tableau de bord Supabase, désactiver « Verify JWT », ajouter les secrets.
6. Créer un Database Webhook sur l'insertion dans `messages` vers la fonction, avec l'en-tête `x-webhook-secret`.
7. Remplir `config.js` sur GitHub.
8. Activer `pg_cron` et `pg_net` (Database > Extensions), puis exécuter `supabase/monthly.sql` après y avoir mis l'identifiant du projet et le secret.

Le guide détaillé pas à pas et la checklist avant le départ sont dans le document partagé « ROADTRIP – Guide de mise en route ».

## Limites à connaître

- L'appli **ne remplace pas les secours locaux** : le SOS prévient le groupe, il n'appelle personne.
- Sur Android, les notifications passent par les services Google : **en Chine, elles n'arrivent pas sans VPN**, alertes SOS comprises.
- Les fiches pays et les numéros d'urgence sont des repères à revérifier avant le départ sur diplomatie.gouv.fr.
