# ⚡ EV Finder

Application web (PWA) pour trouver les bornes de recharge rapide **CCS** sur votre trajet et planifier vos arrêts de recharge, pensée **mobile-first**.

> Stack : **Vue 3** (Composition API) · **Vite** · **Leaflet** · **Workbox** (PWA). Données via APIs publiques (OpenChargeMap, OSRM, Photon, OpenStreetMap).

## Fonctionnalités

### Carte & recherche de bornes
- Bornes affichées sur une carte interactive (Leaflet + OpenStreetMap), avec position GPS temps réel.
- Marqueurs dont la **taille s'adapte au zoom** (petits quand on dézoome pour ne pas masquer l'itinéraire).
- Bouton **Refresh** pour recharger les bornes autour de soi / le long du trajet.
- Lien **« Fiche »** vers la page détaillée de la borne sur OpenChargeMap.

### Menu Options (⚙️)
Pour garder l'écran principal épuré, les réglages secondaires sont regroupés dans un panneau déroulant :
- **Autonomie max** de la voiture
- **Été / Hiver** (consommation 19 vs 25 kWh/100 km, −24 % d'autonomie en hiver)
- **Péages** (évitement quand supporté par le routeur)
- **Aller / Aller-retour**
- **CCS uniquement**
- **Sur ma route** (couloir de 5 km autour du tracé)
- **Sans Tesla** (exclut les Superchargeurs des bornes et des arrêts)
- **Puissance minimale** (Tout / 50 / 100 / 150 / 300 kW — défaut 100 kW)
- **Rayon** de recherche (5–100 km, hors trajet)
- Téléchargement de la **carte hors-ligne** le long du trajet

### Planification de trajet
- Recherche de destination avec autocomplétion (Photon / OpenStreetMap).
- Calcul d'itinéraire + **itinéraires alternatifs** (OSRM).
- **Autonomie restante** en saisie numérique rapide, sur la même ligne que la destination.
- **Arrêts de recharge recommandés** : algorithme glouton qui minimise le nombre d'arrêts (recharge cible 80 %, marge de sécurité 10 %). Liste repliable, chaque arrêt est **cliquable** pour le centrer sur la carte.
- **Envoyer vers une appli de navigation** : boutons **Google Maps** (avec la borne intégrée en point de passage départ → borne → destination) et **Apple Plans** (itinéraire vers la borne — Apple ne supporte pas de point de passage via URL).

### PWA / hors-ligne
- Installable sur mobile.
- Cache des tuiles de carte (CacheFirst), des données de bornes et des recherches d'adresses (NetworkFirst) via Workbox.

## Démarrage

Prérequis : Node.js ≥ 20.

```bash
npm install
cp .env.example .env   # puis renseignez votre clé
npm run dev
```

### Configuration

Une clé API OpenChargeMap (gratuite) est requise. Créez-la sur
[openchargemap.org/site/develop/api](https://openchargemap.org/site/develop/api),
puis dans `.env` :

```env
VITE_OPENCHARGE_API_KEY=your_openchargemap_api_key_here
```

> ℹ️ **Note** : c'est une application **côté client**. La variable `VITE_*` est
> intégrée au bundle JavaScript au build et est donc **visible** par quiconque
> utilise le site déployé. Les clés OpenChargeMap sont gratuites et à faible risque ;
> utilisez une clé dédiée à ce projet et faites-la tourner si besoin.

## Scripts

```bash
npm run dev       # serveur de dev + HMR
npm run build     # build de production dans /dist
npm run preview   # prévisualiser le build
```

## Déploiement

Configuré pour **Netlify** (`netlify.toml` : build `npm run build`, publication `dist/`,
redirections SPA vers `/index.html`). La clé `VITE_OPENCHARGE_API_KEY` se définit dans
les variables d'environnement du dashboard Netlify (jamais commitée).

## APIs utilisées

| Service        | Usage                       | Cache     |
| -------------- | --------------------------- | --------- |
| OpenChargeMap  | Données des bornes          | 5 min     |
| OpenStreetMap  | Tuiles de carte             | 30 jours  |
| OSRM           | Calcul d'itinéraire         | 1 heure   |
| Photon (Komoot)| Autocomplétion d'adresses   | 1 jour    |

## Architecture

Voir [`CLAUDE.md`](./CLAUDE.md) pour le détail (composables, flux de données,
notes d'implémentation de l'algorithme de planification).

## Licence

MIT
