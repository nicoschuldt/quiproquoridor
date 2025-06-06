# Installation Quoridor - Guide complet

## Prerequisites

### 1. Installer Docker Desktop

#### Windows
1. Aller sur https://www.docker.com/products/docker-desktop/
2. Cliquer sur "Download for Windows"
3. Executer le fichier `.exe` telecharge
4. Suivre l'assistant d'installation (accepter tout)
5. Redemarrer l'ordinateur si demande
6. Lancer Docker Desktop depuis le menu Demarrer
7. Attendre que Docker soit "Running" (icone verte)

#### macOS
1. Aller sur https://www.docker.com/products/docker-desktop/
2. Cliquer sur "Download for Mac"
3. Choisir votre puce (Intel ou Apple Silicon)
4. Glisser Docker.app dans le dossier Applications
5. Lancer Docker depuis Applications
6. Autoriser l'acces si demande
7. Attendre que Docker soit "Running" (icone verte)

### 2. Verifier Docker
Ouvrir un terminal/invite de commande.
Taper cette commande :
```bash
docker --version
```
Vous devriez voir quelque chose comme `Docker version 24.x.x`

## Installation du projet

### 3. Telecharger le projet
Telecharger le zip du projet et extraire le contenu dans le dossier de votre choix.
Ouvrir un terminal dans le dossier extrait.


### 4. Lancer l'application

#### Premiere fois (build + start)
```bash
docker-compose up --build
```

Cette commande va :
- Telecharger les images necessaires
- Construire l'application
- Demarrer frontend + backend
- Cela prend 5-10 minutes la premiere fois

#### Fois suivantes (juste start)
IMPORTANT : Si vous avez deja lance l'application une premiere fois, il faut effacer la base de donnees sqlite pour le script db:seed ne cause pas d'erreur.
Effacer le fichier data/quoridor.db et lancer la commande suivante :
```bash
docker-compose up
```

### 5. Acceder a l'application

Attendre que vous voyez ces messages :
```
frontend-1  | Local:   http://localhost:3000
backend-1   | Server running on port 3001
```

Ouvrir votre navigateur :
- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:3001

## Verification

### 6. Tester que tout marche

1. Aller sur http://localhost:3000
2. Vous devriez voir la page d'accueil Quoridor
3. Essayer de creer un compte
4. Essayer de rejoindre une partie

Si ca marche, felicitations ! L'installation est terminee.

## Arret et redemarrage

### Arreter l'application
Dans le terminal ou ca tourne, appuyer sur `Ctrl+C`

Ou dans un autre terminal :
```bash
docker-compose down
```

### Redemarrer
```bash
docker-compose up
```

## Problemes courants

### Docker Desktop ne demarre pas
- Verifier que la virtualisation est activee dans le BIOS
- Redemarrer l'ordinateur
- Reinstaller Docker Desktop

### "Port already in use"
Quelqu'un utilise deja le port 3000 ou 3001.
```bash
# Arreter tous les conteneurs
docker-compose down

# Voir ce qui utilise le port 3000
netstat -an | grep 3000

# Ou changer les ports dans docker-compose.yml
```

### L'application ne charge pas
1. Verifier que Docker Desktop tourne
2. Attendre 2-3 minutes (premiere fois c'est long)
3. Verifier les logs :
   ```bash
   docker-compose logs
   ```

### Base de donnees vide
```bash
# Reconstruire completement
docker-compose down
docker-compose up --build --force-recreate
```

### Nettoyer Docker (si ca bug trop)
```bash
# Arreter tout
docker-compose down

# Supprimer les volumes
docker-compose down -v

# Nettoyer Docker
docker system prune -a

# Relancer
docker-compose up --build
```

## Development mode

### Modifier le code en live
Pour developper et voir les changements en temps reel :

```bash
# Arreter Docker
docker-compose down

# Installer Node.js : https://nodejs.org/
# Version 18 ou plus recente

# Demarrer backend
cd backend
npm install
npm run dev

# Nouveau terminal - Demarrer frontend
cd frontend  
npm install
npm run dev
```

Frontend : http://localhost:3000
Backend : http://localhost:3001

## Liens utiles

- **Docker Desktop** : https://www.docker.com/products/docker-desktop/
- **Git** : https://git-scm.com/downloads
- **Node.js** : https://nodejs.org/
- **Documentation Docker** : https://docs.docker.com/

## Aide

Si ca marche toujours pas :
1. Copier-coller l'erreur dans Google
2. Verifier que Docker Desktop est bien demarre
3. Redemarrer l'ordinateur
4. Demander de l'aide avec une capture d'ecran de l'erreur 



## OPTION 2: Node.js

### 1. Installer Node.js 23.x.x
https://nodejs.org/

### 2. Installer les dependances
```bash
cd backend
npm install
```

```bash
cd frontend
npm install
```

### 3. Lancer l'application
```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

### 4. Acceder a l'application

http://localhost:3001