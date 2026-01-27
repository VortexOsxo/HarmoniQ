# Guide de contribution — GitHub

Ce document décrit la procédure standard pour travailler sur ce dépôt :
création de branche, conventions de nommage, commits et Pull Requests.

## 1. Mettre à jour la branche principale

Avant de commencer, assurez-vous que la branche `main` est à jour.

```bash
git checkout main
git pull origin main
```

## 2. Créer une nouvelle branche

Convention de nommage des branches

Le nom de la branche doit suivre le format suivant :

```bash
<nom-du-module>/<courte-description-de-la-fonctionnalité>
```

Exemples

```bash
nucleaire/fix-calcul-reservoir
reseau/fix-bilan-energetique
solaire/optimize-production-peak
```

Créer et basculer sur la branche

```bash
git checkout -b nom-du-module/description-fonctionnalite
```

Exemple :

```bash
git checkout -b nucleaire/fix-calcul-reservoir
```

## 3. Créer un commit avec les modifications

Ajouter les fichiers modifiés

```bash
git add .
```

Créer un commit avec un message clair:

```bash
git commit -m "Update water level constraints"
```

## 4. Pousser la branche sur GitHub

```bash
git push -u origin nom-du-module/description-fonctionnalite
```

L’option -u permet de lier la branche locale à la branche distante (uniquement nécessaire lors du premier push).

## 5. Créer une Pull Request (PR)

Lorsque la branche est testée et prête à être ajoutée à la branche principale:

1. Aller sur le dépôt GitHub
2. Cliquer sur “Compare & pull request”
   (ou onglet “Pull requests” → “New pull request”)
3. Vérifier :
   - Base branch : main
   - Compare branch : votre branche
4. Compléter :
   - Titre : résumé clair du changement
   - Description :
     - Ce qui a été fait
     - Pourquoi le changement est nécessaire
     - Toute information utile (captures d’écran, limitations, etc.)
5. Cliquer sur Create pull request
6. Informer ses collègues du pull request pour qu'ils puissent la vérifier

## 6. Après la création de la PR

- Répondre aux commentaires de revue si nécessaire
- Ajouter de nouveaux commits sur la même branche si des corrections sont demandées
- La PR se mettra à jour automatiquement
- Lorsque la PR est approuvée, résoudre les conflits et appuyer sur 'Merge pull request' pour appliquer les changements sur la branche principale
