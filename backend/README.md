# Backend Quoridor

## Description
API REST et serveur websocket pour le jeu Quoridor. Gere logique metier, authentification, persistence donnees et systeme IA.

## Stack technique
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Base de donnees**: SQLite + Drizzle ORM
- **WebSocket**: Socket.io
- **Authentification**: JWT + Passport
- **Tests**: Jest
- **Validation**: Zod

## Architecture

### Structure dossiers
```
src/
├── game/             # Logique jeu Quoridor
├── ai/               # Systeme intelligence artificielle  
├── auth/             # Authentification et autorisation
├── socket/           # Gestion websockets temps reel
├── routes/           # Routes API REST
├── middleware/       # Middlewares Express
├── db/               # Schema base donnees et migrations
└── config/           # Configuration application
```

## Fonctionnalites principales

### API Jeu
- Creation et gestion parties
- Validation complete regles Quoridor
- Historique coups et replay
- Support 2-4 joueurs simultanes

### Systeme IA
- 3 niveaux difficulte (easy/medium/hard)
- Tours automatiques sans intervention
- Algorithmes pathfinding optimises
- Strategies blocage adversaires

### Multijoueur
- Rooms temps reel via websockets
- Gestion deconnexions/reconnexions
- Synchronisation etats entre clients
- Timeouts configurable forfait

### Authentification
- Systeme JWT securise
- Gestion utilisateurs complets
- Protection routes sensibles
- Refresh tokens automatique

### Boutique
- API themes pions personnalises
- Integration Stripe paiements
- Gestion collections utilisateurs
- Validation achats securisee

## Modules principaux

### Game (`/src/game/`)
- `QuoridorEngine.ts` - Moteur jeu complet avec regles
- `GameStateService.ts` - Persistence etats et tours IA  
- `GameEngineManager.ts` - Proxy pour basculer moteurs
- Architecture detaillee dans `game/README.md`

### AI (`/src/ai/`)
- `AIManager.ts` - Factory creation instances IA
- `RandomAI.ts` - IA niveau facile (coups aleatoires)
- `GreedyAI.ts` - IA avancee avec strategies
- Architecture detaillee dans `ai/README.md`

### Auth (`/src/auth/`)
- Strategies Passport (local + JWT)
- Middleware verification tokens
- Gestion sessions utilisateurs
- Hachage mots de passe bcrypt

### Socket (`/src/socket/`)
- Gestion connexions websocket
- Events temps reel parties
- Synchronisation etats clients
- Gestion rooms et deconnexions

### Database (`/src/db/`)
- Schema Drizzle ORM complet
- Migrations versionnees
- Seeds donnees test
- Relations complexes optimisees

## Routes API principales

### Authentification
```
POST /api/auth/register     # Inscription utilisateur
POST /api/auth/login        # Connexion
POST /api/auth/refresh      # Refresh token
POST /api/auth/logout       # Deconnexion
```

### Jeu
```
POST /api/rooms            # Creer room
GET  /api/rooms/:id        # Details room
POST /api/rooms/:id/join   # Rejoindre room
POST /api/games/:id/move   # Jouer coup
GET  /api/games/:id/state  # Etat partie
```

### Boutique
```
GET  /api/shop/themes      # Liste themes disponibles
POST /api/shop/purchase    # Achat theme
GET  /api/users/themes     # Themes possedes
PUT  /api/users/theme      # Changer theme actif
```

## WebSocket Events

### Game events
```javascript
// Client -> Server
'join-room'        // Rejoindre room
'make-move'        // Effectuer coup
'forfeit'          // Forfait partie

// Server -> Client  
'game-state'       // Nouvel etat partie
'player-joined'    // Joueur rejoint
'player-left'      // Joueur quitte
'game-finished'    // Partie terminee
```

## Base de donnees

### Schema principal
- `users` - Utilisateurs et preferences
- `rooms` - Rooms de jeu
- `games` - Parties et etats
- `game_players` - Association joueurs-parties
- `themes` - Themes pions disponibles
- `user_themes` - Collections themes utilisateurs

### Migrations
```bash
npm run db:generate    # Generer migration depuis schema
npm run db:migrate     # Appliquer migrations pending
npm run db:studio      # Interface graphique Drizzle Studio
```

## Configuration

### Variables environnement
```
NODE_ENV=development
PORT=3001
DB_FILE_NAME=file:./data/quoridor.db
JWT_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_test_...
CORS_ORIGIN=http://localhost:3000
```

### Securite
- CORS configure pour frontend
- Helmet protection headers HTTP
- Validation entrees avec Zod
- Rate limiting (si implemente)

## Scripts disponibles

### Development
```bash
npm run dev          # Serveur avec hot reload
npm run build        # Build TypeScript
npm run start        # Serveur production
```

### Base de donnees
```bash
npm run db:generate  # Generer migrations
npm run db:migrate   # Appliquer migrations  
npm run db:seed      # Donnees de test
npm run db:studio    # Interface graphique
```

### Tests
```bash
npm run test         # Tests unitaires Jest
```