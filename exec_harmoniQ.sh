Interne

#!/bin/bash

codeutilisateur=$(echo "$USER" | grep -o '[0-9]\+')
 
if [ -z "$codeutilisateur" ]; then
    codeutilisateur=5000
fi
 
# Essai de trouver l'environement python
harmoniq_env=$HOME/.harmoniq_env
 
if [ -d $harmoniq_env ]; then
    echo "L'environement python est dÃ©jÃ  installÃ©"
else
    echo "L'environement python n'est pas installÃ©"
    echo "CrÃ©ation d'environement python"
    cd $HOME/CASTOR-S3/CASTOR-S3-POLY-MTL-MODELE-JOUET/HarmoniQ
    pyenv local 3.9.16 # TODO get right version
    python3 -m venv $HOME/.harmoniq_env
    harmoniq_env=$HOME/.harmoniq_env
fi
 
echo "Activation de l'environement python"
source $harmoniq_env/bin/activate
 
# VÃ©rification de l'installation de l'application
harmoniq=$(pip freeze | grep harmoniq)
 
if [ -z "$harmoniq" ]; then
    echo "L'application harmoniq n'est pas installÃ©e"
    echo "Installation de l'application harmoniq"
    cd $HOME/CASTOR-S3/CASTOR-S3-POLY-MTL-MODELE-JOUET/HarmoniQ
    pip install -e ./harmoniQ[dev]
    # Jankey way of forcing the right version of numpy and pypsa
    pip install numpy==1.26.4
    pip install pypsa
else
    echo "L'application harmoniq est dÃ©jÃ  installÃ©e"
fi

# VÃ©rifier si la base de donnÃ©es est dÃ©jÃ  populÃ©e
init-db -R -p
 
# Lancement de l'application

if [ $port="0817" ]; then
    port="1816"
fi

port=$(( $codeutilisateur - 1 ))

while true; do
    port=$(( $port + 1 ))
    if [ -z "$(lsof -i:$port)" ]; then
        break
    fi
done
 
echo "Lancement de l'application harmoniq sur le port $port"
launch-app --debug --port $port