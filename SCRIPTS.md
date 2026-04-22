# Scripts HarmoniQ

## Scripts principaux

### `launch-app` — Lancer le serveur web

Démarre le serveur FastAPI (via Uvicorn) et le client Angular.

```bash
launch-app           # Build le client puis lance le serveur en mode production
launch-app --debug   # Lance le serveur avec rechargement automatique + Angular dev server (ng serve)
launch-app --profile # Active le profiler de performance
```

**Options :**

| Option          | Description                                              |
|-----------------|----------------------------------------------------------|
| `--debug`       | Mode debug : active les logs détaillés, le rechargement automatique d'Uvicorn et le serveur de développement Angular avec proxy |
| `--profile`     | Mode profiler : instrumente les modules pour mesurer les performances |
| `--host`        | Adresse IP du serveur (défaut : `0.0.0.0`)               |
| `--port`        | Port du serveur (défaut : `5000`)                         |
| `--workers`     | Nombre de processus de travail Uvicorn (défaut : `1`)     |
| `--skip-build`  | Ne pas reconstruire le client avant de lancer le serveur  |

Une fois lancé, l'application est accessible sur **http://localhost:5000**.
Excepté en mode debug, où le client est accessible sur **http://localhost:4200**.

---

### `init-db` — Initialiser la base de données

Crée le schéma de la base de données SQLite et la remplit avec les données de référence (centrales thermiques, solaires, éoliennes, barrages hydro, réseau électrique).

```bash
init-db         # Crée les tables sans remplir les données
init-db -p      # Crée les tables et insère toutes les données de référence
init-db -R -p   # Réinitialise la base (supprime puis recrée) et insère les données
```

**Options :**

| Option              | Description                                                   |
|---------------------|---------------------------------------------------------------|
| `-p`, `--populate`  | Remplit la base avec les données de référence (CSVs et Excel) |
| `-f`, `--fill`      | Remplit la base uniquement si elle est vide                    |
| `-R`, `--reset`     | Supprime toutes les tables avant de les recréer               |
| `-t`, `--test`      | Utilise la base de données de test                            |

Les données de référence proviennent des fichiers dans `harmoniq/db/CSVs/` et incluent : parcs éoliens, barrages hydro, centrales thermiques, centrales solaires, bus et lignes du réseau électrique.

---

### `load-db` — Télécharger la base de données

Télécharge le fichier de base de données de demande (`demande.db`) depuis Google Drive et le place dans `harmoniq/db/`.

```bash
load-db
```

Cette commande utilise `gdown` pour télécharger automatiquement le fichier. Si le téléchargement échoue, le fichier peut etre téléchargé manuellement depuis le lien dans le README principal du projet.

---
