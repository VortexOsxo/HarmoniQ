# HarmoniQ

## Prérequis

Pour utiliser ce projet, vous avez besoin de :
* **Python entre 3.8 et 3.11** installé sur votre machine. https://www.python.org/downloads/ - python --version (pour verifier)
* **Git** installé sur votre machine. https://git-scm.com/install/ - git --version (pour verifier)

---

## Guide de prise en main

Suivez ensuite ces étapes dans l'ordre :

### 0 Obtention du code source

Pour obtenir le code source, vous devez cloner le dépôt Git :
1. Ouvrez un terminal ou PowerShell dans le dossier où vous souhaitez installer le projet.
2. Clonez le dépôt Git en exécutant la commande suivante :
```powershell
git clone https://github.com/VortexOsxo/HarmoniQ.git
```

3. Déplacez-vous dans le dossier fraîchement cloné :

```powershell
cd HarmoniQ
```

4. Déplacez-vous dans le dossier contenant le code source :
```powershell
cd harmoniQ
```
### 0.1 Configuration de l'environnement (optionnel mais recommandé)

L'utilisation d'un environnement virtuel (`venv`) est optionnelle, mais fortement recommandée afin d'isoler les dépendances du projet et d'éviter les conflits avec d'autres projets Python installés sur votre machine (en plus de ne pas polluer votre installation globale).

Voici les deux commandes à exécuter en fonction de votre système d’exploitation :

#### Windows
```powershell
# Créer l'environnement virtuel
python -m venv venv

# L'activer
.\venv\Scripts\activate
```

#### Linux / macOS
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

> **Note :** Si le téléchargement automatique échoue, vous pouvez télécharger manuellement la base de données [ici](https://drive.google.com/file/d/1AChv-YwvDrE-nlYdT_aRSumKc571Cqxk/view?usp=sharing) et placer le fichier dans `HarmoniQ/harmoniq/db/`.

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

### 4. Relancer l'application ultérieurement

Une fois l'installation initiale (étapes 0 à 2) terminée, vous n'avez plus besoin de les répéter. Pour relancer l'application lors de vos prochaines sessions :

1. Ouvrez votre terminal dans le dossier du projet.
2. Activez l'environnement virtuel :
   - **Windows** : `.\venv\Scripts\activate`
   - **Linux/macOS** : `source venv/bin/activate`
3. Lancez l'application : `launch-app --debug`
4. visitez le site web avec: `http://127.0.0.1:5000/`

---

## Structure du projet

- **`harmoniq/`** : Code source de la bibliothèque principale.
  - **`modules/`** : Contient les différents modules (eolienne, hydro, solaire, stockage, thermique, transmission).
  - **`utils/`** : Fonctions et classes utilitaires partagées.
  - **`db/`** : Base de données du projet.
  - **`scripts/`** : Scripts d'initialisation et de chargement de la base de données.
- **`tests/`** : Tests unitaires et d'intégration.
- **`pyproject.toml`** : Fichier de configuration du projet et des dépendances.

---

## Contribution

Pour ajouter des fonctionnalités au projet, vous devez ajouter des fonctions dans les modules dont vous êtes responsable :
- `harmoniq/modules/eolienne`
- `harmoniq/modules/hydro`
- `harmoniq/modules/solaire`
- `harmoniq/modules/stockage`
- `harmoniq/modules/thermique`
- `harmoniq/modules/transmission`

### Règles de contribution
- Vous pouvez ajouter de nouveaux fichiers dans ces dossiers, assurez-vous de les importer dans le `__init__.py` correspondant.
- Le code partagé doit être placé dans `harmoniq/utils`. Pour l'utiliser :
  ```python
  from harmoniq.utils import NOM_DE_LA_FONCTION
  ```

### Tests
Les tests sont situés dans le dossier `tests/` et utilisent `unittest`. Pour lancer l'ensemble des tests, utilisez :
```bash
pytest
```
