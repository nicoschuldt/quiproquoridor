# Projet Quoridor

## Description
Application web pour jouer au jeu de plateau Quoridor en ligne. Supporte parties multijoueurs avec IA et systeme de boutique integre.

## Architecture generale

### Stack technique
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + TypeScript 
- **Base de donnees**: SQLite avec Drizzle ORM
- **Communication temps reel**: Socket.io
- **Conteneurisation**: Docker + Docker Compose

### Structure projet
```
/
├── frontend/           # Application React
├── backend/            # API Express + logique jeu + base de donnees SQLite + authentification + websockets + ia
├── shared/            # Types partages entre front/back
├── data/              # Base de donnees SQLite
└── docker-compose.yml # Configuration conteneurs
```

## Fonctionnalites principales

### Jeu Quoridor
- Parties 2-4 joueurs
- IA avec 3 niveaux de difficulte
- Validation complete des regles
- Interface graphique intuitive

### Multijoueur
- Systeme de rooms
- Communication websocket temps reel
- Gestion deconnexions joueurs
- Tours IA automatiques

### Boutique
- Themes de pions personnalises
- Integration Stripe pour paiements
- Gestion collections utilisateurs

## Installation et lancement

### Prerequis
- Node.js 18+
- Docker et Docker Compose

### Methode 1: Docker (recommande)
```bash
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Methode 2: Development local
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (nouveau terminal)
cd frontend  
npm install
npm run dev
```

### Base de donnees
```bash
cd backend
npm run db:migrate    # Creation schema
npm run db:seed      # Donnees de test
npm run db:studio    # Interface graphique
```

## Scripts utiles

### Backend
- `npm run dev` - Serveur development avec hot reload
- `npm run build` - Build production
- `npm run test` - Tests unitaires
- `npm run db:generate` - Generation migrations

### Frontend  
- `npm run dev` - Serveur development Vite
- `npm run build` - Build production
- `npm run preview` - Preview build production

## Configuration

### Variables environnement
- `NODE_ENV` - Mode execution (development/production)
- `PORT` - Port serveur backend (defaut: 3001)
- `VITE_API_URL` - URL backend pour frontend
- `DB_FILE_NAME` - Chemin base de donnees SQLite

### Ports par defaut
- Frontend: 3000
- Backend: 3001
- Base de donnees studio: 4983

## Structure dossiers principaux

### Backend (`/backend/src/`)
- `game/` - Logique jeu Quoridor et gestion etats
- `ai/` - Systeme intelligence artificielle
- `auth/` - Authentification utilisateurs  
- `socket/` - Gestion websockets
- `db/` - Schema base donnees et migrations

### Frontend (`/frontend/src/`)
- `pages/` - Pages principales application
- `components/` - Composants React reutilisables
- `contexts/` - Contextes React (auth, game, etc.)
- `services/` - Appels API et logique metier
- `hooks/` - Hooks React personnalises

## Deploiement
L'application est containerisee et prete pour deploiement sur toute plateforme supportant Docker.
