# 🎮 **Game Engine Integration Guide**

This document provides comprehensive guidance for implementing the Quoridor game engine that will integrate with our existing game state management foundation.

## **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│                    Game Foundation                          │
├─────────────────────────────────────────────────────────────┤
│ GameEngineManager.ts    │ Abstraction layer with mocks      │
│ GameStateService.ts     │ Database persistence & recovery   │
│ gameHandler.ts          │ Socket.io event management        │
│ /routes/games.ts        │ REST API endpoints                │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                 Your Implementation                         │
├─────────────────────────────────────────────────────────────┤
│ QuoridorEngine.ts       │ ◄── IMPLEMENT THIS                │
│ BoardValidator.ts       │ ◄── IMPLEMENT THIS                │
│ PathfindingService.ts   │ ◄── IMPLEMENT THIS                │
└─────────────────────────────────────────────────────────────┘
```

## **What's Already Built**

✅ **Database Schema**: Complete with games, game_players, JSON storage  
✅ **Socket.io Events**: Real-time move broadcasting, connection handling  
✅ **API Endpoints**: Move validation, game state retrieval  
✅ **Authentication**: User verification, room membership checks  
✅ **Mock Game Engine**: Basic implementations for development/testing  
✅ **Game State Management**: Persistence, recovery, synchronization  

## **What You Need to Implement**

### **1. Core Game Engine (`QuoridorEngine.ts`)**

```typescript
import { GameEngine } from '../../../shared/types';

export class QuoridorEngine implements GameEngine {
  
  // ====================================================
  // REQUIRED IMPLEMENTATIONS
  // ====================================================
  
  createGame(playerIds: string[], maxPlayers: 2 | 4): GameState {
    // Create initial game state with:
    // - Players at starting positions (bottom/top for 2P, all sides for 4P)
    // - Empty walls array
    // - Correct wall counts (10 for 2P, 5 for 4P)
    // - Player 0 starts first
  }
  
  validateMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): boolean {
    // Validate all move types:
    // - Pawn moves: adjacent squares, jumping over players, no diagonal
    // - Wall placement: doesn't block paths, doesn't overlap, player has walls
    // - Turn order: correct player
    // - Game state: not finished
  }
  
  applyMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): GameState {
    // Apply move and return new state:
    // - Update player positions for pawn moves
    // - Add walls to walls array for wall placement
    // - Decrement wall count for wall placement
    // - Add move to moves history
    // - Advance to next player
    // - Check for win condition
  }
  
  isGameFinished(gameState: GameState): boolean {
    // Check if any player reached their goal row
  }
  
  getWinner(gameState: GameState): string | null {
    // Return player ID who reached their goal, or null
  }
  
  getValidMoves(gameState: GameState, playerId: string): Omit<Move, 'id' | 'timestamp'>[] {
    // Generate all valid moves for a player:
    // - All valid pawn moves (adjacent + jumps)
    // - All valid wall placements
    // Use this for UI hints and AI
  }
  
  // ====================================================
  // MOVEMENT VALIDATION
  // ====================================================
  
  isValidPawnMove(gameState: GameState, fromPos: Position, toPos: Position, playerId: string): boolean {
    // Implement Quoridor movement rules:
    // 1. Adjacent square movement (no diagonal)
    // 2. Jumping over adjacent players
    // 3. No wall blocking the path
    // 4. Destination square is empty
  }
  
  isValidWallPlacement(gameState: GameState, wallPos: Position, orientation: WallOrientation): boolean {
    // Implement wall placement rules:
    // 1. Wall doesn't overlap existing walls
    // 2. Wall doesn't block all paths to goal (CRITICAL!)
    // 3. Wall position is within board bounds
    // 4. Player has walls remaining
  }
  
  hasValidPathToGoal(gameState: GameState, playerId: string): boolean {
    // CRITICAL: Implement pathfinding algorithm
    // Must ensure wall placement doesn't completely block a player
    // Use BFS/A* to check if path exists from current position to goal row
    // This is called after each wall placement
  }
}
```

### **2. Board Utilities (`BoardValidator.ts`)**

```typescript
export class BoardValidator {
  
  // Path validation using pathfinding
  static hasPathToGoal(
    playerPos: Position, 
    goalRow: number, 
    walls: Wall[], 
    players: Player[]
  ): boolean {
    // Implement BFS or A* pathfinding
    // Return true if path exists from playerPos to any square in goalRow
  }
  
  // Wall collision detection
  static wallsIntersect(wall1: Wall, wall2: Wall): boolean {
    // Check if two walls overlap or intersect
  }
  
  // Check if wall blocks a specific path
  static wallBlocksPath(
    fromPos: Position, 
    toPos: Position, 
    wall: Wall
  ): boolean {
    // Check if wall blocks movement between two adjacent squares
  }
  
  // Get all positions blocked by walls
  static getBlockedPaths(walls: Wall[]): Set<string> {
    // Return set of "x1,y1,x2,y2" strings representing blocked paths
  }
}
```

### **3. Pathfinding Service (`PathfindingService.ts`)**

```typescript
export class PathfindingService {
  
  static findPath(
    start: Position,
    goalRow: number,
    walls: Wall[],
    players: Player[]
  ): Position[] | null {
    // Implement BFS or A* to find shortest path
    // Return path as array of positions, or null if no path exists
  }
  
  static hasPath(
    start: Position,
    goalRow: number,
    walls: Wall[],
    players: Player[]
  ): boolean {
    // Quick check if path exists (don't need full path)
    return this.findPath(start, goalRow, walls, players) !== null;
  }
}
```

## **Integration Points**

### **Plug in Your Engine**

```typescript
// In backend/src/server.ts or app.ts
import { QuoridorEngine } from './game/QuoridorEngine';
import { gameEngineManager } from './game/GameEngineManager';

// Initialize your engine
const quoridorEngine = new QuoridorEngine();
gameEngineManager.setEngine(quoridorEngine);
```

### **Testing Your Implementation**

```typescript
// Test basic functionality
const engine = new QuoridorEngine();
const gameState = engine.createGame(['player1', 'player2'], 2);

// Test pawn movement
const move = {
  type: 'pawn' as const,
  playerId: 'player1',
  fromPosition: { x: 4, y: 0 },
  toPosition: { x: 4, y: 1 }
};

const isValid = engine.validateMove(gameState, move);
const newState = engine.applyMove(gameState, move);
```

## **Quoridor Rules Reference**

### **Board Setup**
- 9x9 grid with 81 squares
- 2 players: start at (4,0) and (4,8), goal is opposite row
- 4 players: start at middle of each side, goal is opposite side
- Each player gets 10 walls (2P) or 5 walls (4P)

### **Movement Rules**
1. **Pawn moves**: One square orthogonally (no diagonal)
2. **Jumping**: If adjacent square has player, can jump over to next square
3. **Wall blocking**: Cannot move through walls
4. **Goal**: Reach any square in your target row

### **Wall Placement Rules**
1. **Orientation**: Horizontal or vertical, covers 2 square edges
2. **No overlap**: Cannot intersect with existing walls
3. **Path preservation**: MUST leave at least one path to goal for ALL players
4. **Bounds**: Must fit within board boundaries

## **Critical Implementation Notes**

### **🚨 Path Validation is CRITICAL**
The most important rule in Quoridor is that wall placement cannot completely block a player's path to their goal. This requires:

1. **After each wall placement**, check ALL players have a path to their goal
2. **Use proper pathfinding** (BFS recommended for simplicity)
3. **Handle edge cases** like players blocking each other's paths
4. **Performance matters** - this check happens on every wall placement

### **🎯 Move Generation for AI**
The `getValidMoves()` method should return ALL possible moves:
- All reachable squares for pawn movement (including jumps)
- All valid wall placements (that don't violate path rule)
- This enables AI implementation and UI move hints

### **💾 State Immutability**
Always return new `GameState` objects from `applyMove()`:
```typescript
return {
  ...gameState,
  players: updatedPlayers,
  walls: [...gameState.walls, newWall],
  currentPlayerIndex: nextPlayerIndex,
  moves: [...gameState.moves, fullMove]
};
```

## **Testing Strategy**

### **Unit Tests**
```typescript
describe('QuoridorEngine', () => {
  test('should create valid initial game state', () => {
    const gameState = engine.createGame(['p1', 'p2'], 2);
    expect(gameState.players).toHaveLength(2);
    expect(gameState.players[0].position).toEqual({ x: 4, y: 0 });
  });
  
  test('should validate basic pawn moves', () => {
    // Test adjacent moves, jumping, wall blocking
  });
  
  test('should prevent walls that block all paths', () => {
    // Test the critical path validation rule
  });
});
```

### **Integration Tests**
```typescript
describe('Game Flow', () => {
  test('should handle complete 2-player game', () => {
    // Play a full game from start to finish
  });
  
  test('should handle reconnection properly', () => {
    // Test game state persistence and recovery
  });
});
```

## **Debugging & Development**

### **Enable Mock Engine Logging**
The current mock engine logs all operations. Use this to understand the flow:
```bash
# Backend logs will show:
🎮 Game engine connected
⚠️ No game engine - using mock validation
🎯 Player making move: {...}
```

### **Test Socket Events**
Use browser dev tools or a WebSocket client to test real-time events:
```javascript
// In browser console
socket.emit('make-move', {
  roomId: 'your-room-id',
  move: {
    type: 'pawn',
    playerId: 'your-player-id',
    fromPosition: { x: 4, y: 0 },
    toPosition: { x: 4, y: 1 }
  }
});
```

## **Performance Considerations**

- **Pathfinding**: Use BFS for simplicity, optimize later if needed
- **Move generation**: Cache valid moves if performance becomes an issue
- **State serialization**: Game state is stored as JSON in database
- **Memory usage**: Each game state is ~1-10KB in JSON format

---

## **🚀 Ready to Implement?**

1. Start with `QuoridorEngine.createGame()` - get basic game setup working
2. Implement simple pawn movement validation and application
3. Add wall placement (without path validation first)
4. Implement pathfinding and path validation (**most complex part**)
5. Add move generation for UI hints
6. Test thoroughly with edge cases

The existing foundation handles all the networking, persistence, and user management. You just need to focus on the pure game logic!

**Questions?** Check the existing mock implementations in `GameEngineManager.ts` for examples of the expected interfaces. 