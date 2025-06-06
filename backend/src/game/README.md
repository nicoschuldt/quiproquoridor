# Dossier Game: Logique de jeu Quoridor

## Vue d'ensemble
Ce dossier contient la logique complète du jeu Quoridor, incluant les règles, validations, et gestion d'état.

## Architecture

### Pattern utilisé
- **GameEngineManager** : Pattern Proxy pour basculer entre différents moteurs
- **GameStateService** : Service principal pour persistence et gestion tours IA
- **QuoridorEngine** : Implémentation complète des règles Quoridor

## Fichiers principaux

### `GameEngineManager.ts`
- **Rôle** : Gestionnaire proxy pour les moteurs de jeu
- **Pattern** : Proxy - permet changement dynamique de moteur
- **Fonctions clés** :
  - `validateGameState()` : Vérif cohérence complète d'un état
  - `getGameStats()` : Métriques utiles pour debug
- **Spécificité** : Prêt pour integration moteurs avancés (IA sophistiquée, etc.)

### `GameStateService.ts`
- **Rôle** : Service de gestion d'état avec persistence DB
- **Responsabilités** :
  - Création parties depuis rooms
  - Sauvegarde/récupération états
  - **Gestion automatique tours IA** (point critique)
  - Gestion déconnexions joueurs
- **Spécificité** : 
  - Enchaîne automatiquement tous les tours IA consécutifs
  - Cache pour éviter double-envoi websocket
  - Timeouts déconnexion configurables

### `QuoridorEngine.ts`
- **Rôle** : Moteur de jeu complet avec toutes les règles Quoridor
- **Fonctions critiques** :
  - `isValidWallPlacement()` : Validation placement mur (règle complexe)
  - `hasValidPathToGoal()` : Pathfinding BFS pour vérif chemins
  - `getValidMoves()` : Génération tous coups possibles (pour IA)
  - `isValidPawnMove()` : Gestion sauts par-dessus adversaires
- **Spécificités** :
  - Support 2-4 joueurs avec goals différents
  - Pathfinding avec gestion murs et autres joueurs
  - Validation anti-blocage complet (règle Quoridor)

## Points critiques

### Validation placement murs
- Doit vérifier que chaque joueur garde un chemin vers son goal
- Algo BFS pour pathfinding avec obstacles
- Gestion intersections perpendiculaires

### Tours IA automatiques
- `processAITurns()` enchaîne tous les coups IA d'affilée
- Évite attente utilisateur entre tours IA
- Sauvegarde après chaque coup pour récupération

### Gestion déconnexions
- Timeouts configurables par joueur
- Système de forfait automatique
- Nettoyage ressources IA

## Tests
Dossier `__tests__/` contient tests unitaires pour validation règles et edge cases.

## Constantes importantes
- `BOARD_SIZE = 9` : Plateau 9x9
- `MAX_WALLS_2P = 10` : 10 murs par joueur en 2v2
- `MAX_WALLS_4P = 5` : 5 murs par joueur en 4v4