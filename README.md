# EV Charger Finder

Application PWA pour trouver les bornes de recharge rapide (CCS) sur votre trajet.

## Fonctionnalités

### Recherche de bornes
- Affichage des bornes de recharge sur une carte interactive (Leaflet + OpenStreetMap)
- Filtrage par type de connecteur (CCS uniquement par défaut)
- Filtrage par puissance minimale (50kW à 300kW)
- Rayon de recherche ajustable (5km à 100km)
- Affichage des tarifs et lien vers Chargemap

### Planification de trajet
- Recherche de destination avec autocomplétion (Photon/OpenStreetMap)
- Calcul d'itinéraire optimisé (OSRM)
- Affichage des bornes le long du corridor (2km de chaque côté)
- Filtrage "Sur ma route" pour n'afficher que les bornes pertinentes

### Calcul des arrêts de recharge
- Deux sliders : autonomie restante et autonomie max de la voiture
- Recharge à 80% (optimal pour bornes rapides DC)
- Marge de sécurité de 10% (ne pas descendre sous 10%)
- Algorithme glouton : minimise le nombre d'arrêts
- Affichage des arrêts recommandés avec numérotation

### Mode hiver
- Bouton pour basculer entre mode été (19 kWh/100km) et hiver (25 kWh/100km)
- Réduction automatique de l'autonomie effective (-24% en hiver)
- Recalcul des arrêts nécessaires

### Carte interactive
- Position GPS en temps réel avec vitesse
- Marqueurs verts pour les bornes disponibles
- Marqueurs bleus (plus gros, animés) pour les arrêts recommandés
- Tracé de l'itinéraire en vert

### Mode offline
- PWA installable sur mobile
- Cache des tuiles de carte (30 jours, 1000 tuiles)
- Bouton "Offline" pour pré-télécharger les tuiles le long de la route
- Cache des données de bornes (5 minutes)
- Cache des recherches de destination (1 jour)

## Installation

```bash
npm install
```

## Configuration

Créez un fichier `.env` à la racine :

```env
VITE_OPENCHARGE_API_KEY=votre_clé_api
```

Obtenez une clé API gratuite sur [OpenChargeMap](https://openchargemap.org/site/develop/api).

## Développement

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Technologies

- **Vue 3** avec Composition API et `<script setup>`
- **Vite** pour le build et HMR
- **Leaflet** pour la cartographie
- **OpenStreetMap** pour les tuiles de carte
- **OpenChargeMap API** pour les données de bornes
- **OSRM** pour le calcul d'itinéraire
- **Photon (Komoot)** pour l'autocomplétion des adresses
- **Workbox** (via vite-plugin-pwa) pour le mode offline

## APIs utilisées

| Service | Usage | Cache |
|---------|-------|-------|
| OpenChargeMap | Données des bornes | 5 min |
| OpenStreetMap | Tuiles de carte | 30 jours |
| OSRM | Calcul d'itinéraire | 1 heure |
| Photon | Recherche d'adresses | 1 jour |

## Licence

MIT
