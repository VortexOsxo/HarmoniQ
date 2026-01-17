# HarmoniQ

## Prérequis

Pour utiliser ce projet, vous avez besoin de :
* **Python 3.8+** installé sur votre machine.

---

## Guide de prise en main

Pour commencer, ouvrez votre terminal et déplacez-vous dans le dossier contenant le code source :
```powershell
cd harmoniQ
```

Suivez ensuite ces étapes dans l'ordre :

### 0. Configuration de l'environnement (optionnel mais recommandé)

L'utilisation d'un environnement virtuel (`venv`) est optionnelle, mais recommandée afin d'isoler les dépendances du projet et d'éviter les conflits avec d'autres projets Python installés sur votre machine (en plus de ne pas polluer votre installation globale).

Voici les deux commandes à exécuter en fonction de votre système d’exploitation :

#### Windows
```powershell
# Créer l'environnement virtuel
python -m venv venv

# L'activer
.\venv\Scripts\activate
```

### Linux / macOS
```powershell
# Créer l'environnement virtuel
python3 -m venv venv

# L'activer
source venv/bin/activate
```

### 1. Installation des dépendances

Installez le package HarmoniQ en mode éditable avec les outils de développement :

```powershell
pip install -e .[dev]
```

### 2. Initialisation de la base de données

HarmoniQ a besoin d'une base de données pour fonctionner. Vous pouvez la télécharger et l'initialiser automatiquement avec ces deux commandes :

```powershell
# 1. Télécharger la base de données depuis Google Drive
load-db
```

> **Note :** Si le téléchargement automatique échoue, vous pouvez télécharger manuellement la base de données [ici](https://drive.google.com/file/d/1AChv-YwvDrE-nlYdT_aRSumKc571Cqxk/view?usp=sharing) et placer le fichier dans `harmoniq/db/`.

```powershell
# 2. Initialiser le schéma et remplir les données de référence
init-db -p
```



### 3. Lancer l'application

Démarrez le serveur web en mode debug :

```powershell
launch-app --debug
```

Une fois lancé, ouvrez votre navigateur et accédez à :
**[http://localhost:5000](http://localhost:5000)**

---

## Structure du projet

- **`harmoniq/`** : Code source de la bibliothèque principale.
- **`tests/`** : Tests unitaires et d'intégration.
- **`pyproject.toml`** : Fichier de configuration du projet et des dépendances.
