# TypeR Studio

L'application de bureau de TypeR, pour Mac et Windows. Elle embarque le même code que la version
web (`web/`) et ajoute ce qu'un onglet ne peut pas faire : barre de menus du Mac, raccourcis de
Photoshop, ouverture depuis le système, hors-ligne dès le premier lancement, mises à jour signées.

## Au quotidien

```sh
npm install          # une seule fois
npm start            # lance l'app depuis les sources
npm test             # 41 vérifications sur l'app réelle, sans connexion
```

`npm start` et `npm test` copient d'abord les fichiers du site dans `content/`. Git décide de ce
qui est copié : les polices commerciales ignorées restent donc hors de l'app.

## Publier une mise à jour du site vers les apps installées

```sh
npm run publish-web  # écrit web/desktop-update.json, signé
```

À lancer juste avant de committer ce qu'on publie, puis pousser le tout sur `main`.

- Les apps regardent ce fichier au lancement, puis toutes les 6 heures. Elles téléchargent seulement
  les fichiers changés, les vérifient, puis basculent au lancement suivant, ou tout de suite si
  aucune page n'est ouverte.
- Sans cette commande, rien ne casse : les apps restent sur leur version.
- Une version qui ne démarre pas est abandonnée pour la précédente.
- La clé privée est dans `~/.config/typer-studio/update-signing.pem`, hors du dépôt. **Il faut la
  sauvegarder** : sans elle, les apps installées ne pourront plus suivre le site, seulement un nouvel
  installateur. La clé publique est dans `src/update-key.pub.pem`.
- Si une mise à jour de `web/` a besoin d'une app plus récente, monter `minContentShell` dans
  `package.json` : les apps plus anciennes attendront leur propre mise à jour.

## Les nouveautés affichées au démarrage

Au lancement, l'app (bureau et web) montre ce qui est arrivé depuis la dernière ouverture, à partir
de `web/whats-new.json`. Le hook pre-push écrit ce fichier depuis les commits `feat(web)` et
`fix(web)`, le commite avec la signature, dans un seul commit `chore`. Rien à faire de plus.

- La note, c'est le sujet du commit, en anglais. Pour le français, une ligne dans le corps :
  `Note-fr: Nouvelle Gomme magique (Maj+E)`. `Note-en:` remplace le sujet s'il est trop technique.
- Pour un commit déjà fait : `desktop/scripts/whats-new-translations.json`, par les 12 premiers
  caractères du hash. À commiter avant de pousser.
- Un premier lancement ne montre rien. Aide → Nouveautés remontre les 7 derniers jours.
- « Ne plus afficher » coupe la fenêtre au démarrage ; la décocher depuis Aide → Nouveautés la remet.
- Comment écrire des notes claires : voir `AGENTS.md` à la racine.

## Construire les installateurs

### Mac, signé et notarisé

Une seule préparation, sur le Mac qui construit :

1. Créer le certificat **Developer ID Application** : Xcode, Réglages, Comptes, Gérer les certificats,
   bouton +. Seul le titulaire du compte Apple Developer peut le créer. Les certificats « Apple
   Development » ne suffisent pas pour distribuer hors de l'App Store.
2. Enregistrer les identifiants de notarisation, avec un mot de passe d'application créé sur
   account.apple.com :

   ```sh
   xcrun notarytool store-credentials typer-studio --apple-id <email> --team-id <équipe>
   ```

Ensuite :

```sh
CSC_NAME="Adrien Devoe (4A2K68QQ82)" APPLE_KEYCHAIN_PROFILE=typer-studio npm run dist:mac
```

Le certificat actuel a été émis par l'ancienne autorité d'Apple et **expire le 1er février 2027**. Les
apps déjà notarisées continuent de s'ouvrir après cette date, mais il en faudra un nouveau pour signer
les versions suivantes. Sur la page des certificats Apple Developer, choisir alors **G2 Sub-CA**, qui
tient bien plus longtemps.

Pour un essai sur ce Mac seulement, sans certificat :

```sh
npm run content && npx electron-builder --mac dmg --arm64 -c.mac.identity=- -c.mac.notarize=false -c.mac.hardenedRuntime=false --publish never
```

### Windows

```sh
npm run dist:win     # fonctionne aussi depuis un Mac
```

Sans certificat de signature, Windows affiche l'avertissement SmartScreen à l'installation.

### Publier l'app elle-même

Les installateurs dépassent la limite de 100 Mo par fichier de GitHub : ils vont dans les Releases de
`ScanR/TypeR-Web`, où `electron-updater` les cherche.

```sh
GH_TOKEN=... CSC_NAME="Adrien Devoe (4A2K68QQ82)" APPLE_KEYCHAIN_PROFILE=typer-studio npx electron-builder --mac --win --publish always
```

Sur Mac, la mise à jour automatique de l'app ne marche que si elle est signée.

## Tests sur machine réelle

- `node scripts/test-mac-native.js "dist/mac-arm64/TypeR Studio.app"` : vraies frappes clavier et vrais
  sélecteurs de fichiers. Demande la permission Accessibilité et prend le focus.
- `node scripts/test-windows.js "<chemin de TypeR Studio.exe>"` : la même chose sur l'app installée sous
  Windows, plus une comparaison de mémoire et de fluidité avec Chrome. Demande `playwright-core`.

## Changer le nom

Tout est à faire avant la première publication, car `appId` identifie l'app sur le système et
ses données :

- `productName`, `build.productName` et `build.appId` dans `package.json`
- `TypeR Studio` dans `web/desktop.js`
- `TypeRStudio.psd` et `typer-studio-updater` dans `build/installer.nsh`
