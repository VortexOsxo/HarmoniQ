**Guide d'installation**

HarmoniQ

# 

# **1\. Prérequis**

### Backend

* Python entre 3.8 et 3.11

* pip

### Frontend

* Node.js 18 ou supérieur

* npm

### Outils recommandés

* VS Code avec les extensions Python et Angular Language Service

* Git

# **2\. Installation du backend**

cd harmoniQ

\# Créer et activer l'environnement virtuel (ex: Python 3.11)  
python \-3.11 \-m venv venv

\# Windows  
.\\venv\\Scripts\\activate  
\# macOS / Linux  
source venv/bin/activate

\# Installer les dépendances  
pip install \-e .\[dev\]

Télécharger les bases de données :

\# Ajouter le fichier demande.db dans \\harmoniQ\\harmoniq\\db\\ (\~7.8 Go)  
\# Cette commande est disponible   
load-db

Initialiser les bases de données :

\# Initialiser le schéma SQLite et charger les données d’infrastructure et de scénarios de base  
init-db \-p  
\# L’option \-–reset permet de réinitialiser la base de données

# 

# **3\. Installation du frontend**

cd client  
npm ci

# 

# **4\. Démarrage**

cd harmoniQ  
.\\venv\\Scripts\\activate  \# ou source venv/bin/activate  
launch-app \--debug  
launch-app \--debug démarre le backend et lance automatiquement ng serve pour le frontend. L'application est accessible sur http://localhost:4200.

Options disponibles :

* \--debug : active le rechargement automatique et lance ng serve

* \--host : adresse d'écoute (défaut : 127.0.0.1)

* \--port : port d'écoute (défaut : 5000)

* \--profile : active le profilage de performance

La documentation de l'API est accessible sur http://localhost:5000/docs ou http://localhost:5000/redoc

# 

# **5\. Lancement des tests**

### Backend

cd harmoniQ

\# Lancer tous les tests  
pytest

\# Mode verbeux  
pytest \-v

\# Exclure les tests nécessitant des données externes (ERA5, PVGIS)  
pytest \-m "not integration"

\# Exclure les tests de performance  
pytest \-m "not performance"

\# Cibler un fichier ou un dossier spécifique  
pytest tests/unit/  
pytest tests/unit/test\_eolienne\_calcule.py

### Frontend

cd client  
npm test