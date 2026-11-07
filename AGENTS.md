# TypeR-Web : consignes pour les agents

## Les nouveautés affichées aux utilisateurs

Au démarrage, TypeR Studio (bureau et web) montre ce qui a changé depuis la dernière ouverture. Ces
notes viennent directement des messages de commit : le hook pre-push les rassemble dans
`web/whats-new.json` (voir `desktop/scripts/whats-new.js`). Chaque commit `feat(web)` ou `fix(web)`
est donc lu par les utilisateurs. Il doit être écrit pour eux, pas pour un développeur.

### Quel type de commit

- `feat(web): …` : une chose nouvelle que l'utilisateur peut faire. Section « Nouveautés ».
- `fix(web): …` : un problème que l'utilisateur a pu rencontrer et qui ne se produit plus. Section
  « Corrections ».
- Tout ce que l'utilisateur ne voit pas ne doit pas apparaître : refactorisation, tests, outils,
  performance invisible, synchronisation du panneau, correctif d'un bug jamais publié. Utiliser
  `chore(web)`, `refactor(web)`, `test(web)`, ou une autre portée (`site`, `desktop`).
- Un changement visible = un commit. Ne pas mélanger plusieurs nouveautés sans rapport dans un
  même commit, ni découper une nouveauté en plusieurs `feat` qui n'ont de sens qu'ensemble.

### Le sujet : la note en anglais

- Une phrase courte, environ 80 caractères au plus, qui dit ce que l'utilisateur gagne ou ce qui
  ne lui arrive plus. La majuscule et le point final sont gérés automatiquement.
- Les mots de l'interface : les noms exacts des outils, menus et réglages tels qu'ils apparaissent
  dans l'app (Magic Eraser, Batch Save, Line Breaks…), et le raccourci entre parenthèses s'il y en a
  un.
- Pour une correction, décrire le résultat, pas la cause : « PSD files saved by TypeR open in
  Photoshop without an error », pas « align the document's own PSD blocks on 4 bytes ».
- Aucun nom de fichier, de fonction ou de variable, aucun jargon (worker, canvas, cache, offset…).

### Le corps : la note en français

Toujours ajouter une ligne `Note-fr:` dans le corps du commit, avec les termes de l'interface
française de l'app (voir `web/strings/fr.js`) :

```
feat(web): add the Magic Eraser (Shift+E)

Note-fr: Nouvelle Gomme magique (Maj+E)
```

Si le sujet doit rester précis pour l'historique mais serait obscur pour l'utilisateur, ajouter
`Note-en:` : c'est cette ligne qui s'affiche à la place du sujet.

```
fix(web): align the document's own PSD blocks on 4 bytes

Note-en: PSD files saved by TypeR open in Photoshop without an error
Note-fr: Les PSD enregistrés par TypeR s'ouvrent dans Photoshop sans erreur
```

### Corriger une note déjà commitée

Ne pas réécrire l'historique de `main`. Ajouter ou corriger la note dans
`desktop/scripts/whats-new-translations.json`, sous `en` ou `fr`, avec les 12 premiers caractères
du hash du commit, puis commiter ce fichier avant de pousser. Une ligne `Note-xx:` du commit passe
avant ce fichier.

### Vérifier avant de pousser

```sh
node desktop/scripts/whats-new.js   # régénère web/whats-new.json et signale les notes sans français
```

Relire les premières lignes de `web/whats-new.json` comme un utilisateur les lirait. Le hook
pre-push refuse un push de `main` dont les notes ou la signature ne sont pas à jour ; il les écrit
et les commite lui-même, et il suffit de relancer le push.
