# Dossier AI - Intelligence Artificielle

## Vue d'ensemble
Système d'IA modulaire pour le jeu Quoridor avec différents niveaux de difficulté et stratégies.

## Architecture

### Pattern utilisé
- **AIManager** : Factory pattern pour créer et gérer les instances IA
- **AIEngine interface** : Contrat commun pour tous les types d'IA
- **Implémentations** : RandomAI, GreedyAI avec variantes

## Fichiers principaux

### `AIManager.ts`
- **Rôle** : Gestionnaire central des IA
- **Pattern** : Factory + Registry
- **Fonctions** :
  - `createAI()` : Création instance selon difficulté
  - `generateMove()` : Point d'entrée pour tous appels IA
- **Mapping difficulté** :
  - `easy` → RandomAI
  - `medium` → GreedyAI (normal)
  - `hard` → GreedyAI (agressif)

### `RandomAI.ts`
- **Niveau** : Facile
- **Stratégie** : Sélection aléatoire pure
- **Utilisation** :
  - Débutants
  - Tests de base
  - Fallback si autres IA échouent
- **Performance** : Instantané (0ms réflexion)

### `GreedyAI.ts`
- **Niveaux** : Medium + Hard
- **Stratégie avancée** :
  1. **Phase blocage** : Analyser adversaires proches du goal
  2. **Phase avancement** : Minimiser sa propre distance au goal
  3. **Fallback** : Coup aléatoire si bloqué

## Stratégies IA

### RandomAI - Facile
```
Pour chaque tour:
1. Récupérer tous coups valides
2. Choisir un index aléatoire
3. Jouer le coup
```

### GreedyAI - Medium/Hard
```
Pour chaque tour:
1. Si on a des murs:
   - Calculer distance chaque adversaire à son goal
   - Si adversaire proche (seuil): chercher mur bloquant optimal
   - Si mur trouvé: le jouer
2. Sinon:
   - Tester tous coups de pion possibles
   - Simuler position résultante
   - Choisir coup qui minimise distance à notre goal
3. Fallback: coup aléatoire
```

### Différences Medium vs Hard
- **Medium** : Seuil blocage = 4 moves, réflexion 100ms
- **Hard** : Seuil blocage = 2 moves, réflexion 400ms (plus agressif)

## Algorithmes clés

### Pathfinding BFS
- **Usage** : Calcul distance exacte vers goal
- **Input** : Position actuelle, état jeu, joueur
- **Output** : Nombre minimum de coups vers goal
- **Gestion** :
  - Murs comme obstacles
  - Autres joueurs (avec possibilité saut)
  - Goals différents selon position joueur

### Évaluation murs bloquants
```
Pour chaque placement mur possible:
1. Simuler placement (deep copy état)
2. Recalculer chemin adversaire
3. Si nouveau chemin = infini: mur parfait (retour immédiat)
4. Sinon: calculer allongement = nouveau - ancien
5. Garder mur avec meilleur allongement
```

## Intégration système

### Création automatique
- IA créées lors setup partie si joueur marqué `isAI: true`
- Instance stockée dans AIManager avec playerId comme clé
- Nettoyage automatique fin partie

### Tours automatiques
- `GameStateService.processAITurns()` appelle `generateMove()`
- Enchaînement automatique si plusieurs IA consécutives
- Validation moves avant application
- Logs détaillés pour debug