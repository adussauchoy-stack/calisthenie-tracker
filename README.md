# Calisthénie — suivi de perfs

PWA de suivi de calisthénie. Statique, sans dépendance, hors-ligne.

## Lancer en local
    cd calisthenie
    python -m http.server 8123
    # ouvrir http://localhost:8123/index.html

## Tests
    node --test tests/model.test.js tests/store.test.js   # logique
    npx playwright test tests/e2e.spec.js                 # UI (serveur sur :8123)

## Déployer gratuitement (au choix)
- **GitHub Pages** : pousser le dossier `calisthenie/` sur une branche, activer Pages sur ce dossier.
- **Netlify / Cloudflare Pages** : glisser-déposer le dossier `calisthenie/`, aucune config de build.
L'hébergeur fournit une URL `https://…` (requis pour le service worker).

## Mettre à jour l'app déployée
Le service worker sert les fichiers depuis un cache figé (`CACHE = 'cali-v1'` dans
`service-worker.js`). Après **toute** modification d'un fichier de l'app, incrémente ce nom
(`cali-v1` → `cali-v2`) avant de redéployer. Sans ça, les appareils déjà installés continuent
de servir l'ancienne version en cache.

## Installer sur iPhone
1. Ouvrir l'URL `https://…` dans **Safari**.
2. Bouton **Partager** → **« Sur l'écran d'accueil »**.
3. L'app s'ouvre en plein écran et fonctionne **hors-ligne, PC éteint**.

## Sauvegarde
Les données vivent dans le téléphone (`localStorage`). Utiliser **Réglages → Exporter**
régulièrement (un fichier `.json` à ranger dans Fichiers/iCloud). Un bandeau rappelle
d'exporter après 10 séries. **Réglages → Importer** pour restaurer.
