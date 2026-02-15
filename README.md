# MiniATC — Jeu de contrôle aérien 2D

MiniATC est une version minimale d'un jeu web 2D d'ATC inspiré par VATSIM / EuroScope, optimisée pour être lancée sur iPhone via Safari (ajouter à l'écran d'accueil).

Fichiers principaux:
- index.html — page principale
- css/style.css — styles et disposition
- js/app.js — logique de simulation et contrôles tactiles
- manifest.json — manifeste PWA
- service-worker.js — cache simple

Lancer localement:
1. Ouvrir `index.html` dans un navigateur moderne (Safari sur iPhone pour expérience native).  
2. Pour un test complet PWA, servir via un petit serveur (par ex. `npx http-server` ou `python -m http.server`).

Commandes d'exemple:
```
python -m http.server 8000
# ou
npx http-server . -p 8000
```

Sur iPhone: ouvrir l'URL, puis utiliser le menu partage → "Ajouter à l'écran d'accueil" pour lancer en plein écran.

Souhaitez-vous que j'ajoute :
 
Fichier autonome (téléchargeable)
- Vous pouvez fournir à un utilisateur un seul fichier HTML autonome qui fonctionne sans serveur. J'ai ajouté `miniatc-standalone.html`.
- Pour permettre à un iPhone d'ouvrir directement : téléchargez `miniatc-standalone.html` depuis Safari ou transférez-le dans l'app "Fichiers". Ouvrez-le dans Safari (taper sur le fichier) — le jeu s'exécutera directement.
- Pour une expérience plein écran : ouvrir le fichier dans Safari puis utiliser Partager → "Ajouter à l'écran d'accueil".

Changements récents:
- Ajout d'icônes vectorielles (SVG) pour avions / fighters / aéroports (meilleure lisibilité que des emojis).
- Amélioration de la sélection tactile: zone de sélection agrandie et priorité visuelle.
- `Airports`: tapez sur un aéroport pour lancer un avion civil depuis cet aéroport.
- `Fighters`: sélectionnez un avion ennemi ou allié puis utilisez «Dispatch Fighter» pour envoyer un chasseur depuis l'aéroport le plus proche. Les fighters tentent d'intercepter (et retirent l'ennemi).
- `Enemies`: des avions ennemis apparaissent périodiquement (rouges). Vous pouvez intercepter.
- `Loading`: écran de chargement au démarrage pour éviter l'affichage vide.

Test rapide:
1. Démarrer un serveur local (ou ouvrir `miniatc-standalone.html` dans Safari via HTTP):
```powershell
python -m http.server 8000
```
2. Sur iPhone: ouvrez `http://<votre-ip>:8000/` puis `miniatc-standalone.html` ou `index.html`.

Prochaines améliorations possibles (je peux les faire):
- ajouter icônes iOS / splash screens dans le ZIP
- système de scoring + missions (escortes, interceptions)
- commandes radio textuelles (simuler VATSIM)
- sauvegarde / relecture de scénarios
Remarques :
- Certaines fonctions PWA (service worker, cache avancé, ajout automatique à l'écran d'accueil) nécessitent un serveur HTTPS et ne fonctionnent pas correctement depuis un fichier local. Cette version autonome inclut tout le CSS/JS inline pour être exécutée directement.
- Voulez-vous que je crée un ZIP téléchargeable contenant `miniatc-standalone.html` et des icônes pour simplifier la distribution ?
 
Préparer pour GitHub
- J'ai ajouté les fichiers suivants pour faciliter la publication sur GitHub dans ce dossier:
	- `.gitignore`
	- `LICENSE` (MIT)
	- `create-zip.ps1` — script PowerShell pour créer `miniatc-release.zip` contenant le projet (exclut `.git`)

Étapes pour publier sur GitHub (manuellement):
1. Créez un nouveau dépôt sur GitHub (vide).
2. Depuis ce dossier sur votre PC:
```powershell
cd "c:\Users\FX 2\Desktop\FX CONTROL"
git init
git add .
git commit -m "Initial commit: MiniATC"
git remote add origin https://github.com/<votre-utilisateur>/<votre-repo>.git
git branch -M main
git push -u origin main
```
3. Une fois poussé, activez GitHub Pages si vous voulez héberger la version web statique (Settings → Pages → branch `main` / root).

Créer le ZIP de distribution (optionnel):
```powershell
cd "c:\Users\FX 2\Desktop\FX CONTROL"
.\create-zip.ps1
```

Si vous voulez, je peux:
- préparer les icônes iOS et les inclure dans le ZIP
- créer automatiquement un dépôt GitHub et y pousser les fichiers (j'aurai besoin d'un token ou vous devrez exécuter le push localement)

