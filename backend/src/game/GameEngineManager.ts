import type { 
  GameEngine, 
  GameState, 
  Move, 
  Player, 
  Position, 
  WallOrientation 
} from '../../../shared/types';

/**
 * GameEngineManager - Abstraction layer for game engine integration
 * 
 * This class provides a clean interface for the future game engine implementation.
 * The actual game logic will be plugged in here by another engineer.
 */
export class GameEngineManager implements GameEngine {
  private engine: GameEngine | null = null;

  /**
   * Sets the actual game engine implementation
   * This will be called when the game engine is ready
   */
  setEngine(engine: GameEngine): void {
    this.engine = engine;
    console.log('🎮 Game engine connected');
  }

  /**
   * Checks if game engine is available
   */
  isEngineReady(): boolean {
    return this.engine !== null;
  }

  // ==========================================
  // GAME ENGINE INTERFACE IMPLEMENTATION
  // ==========================================

  createGame(playerIds: string[], maxPlayers: 2 | 4): GameState {
    if (!this.engine) {
      return this.createMockGameState(playerIds, maxPlayers);
    }
    return this.engine.createGame(playerIds, maxPlayers);
  }

  validateMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): boolean {
    if (!this.engine) {
      console.warn('⚠️ No game engine - using mock validation');
      return this.mockValidateMove(gameState, move);
    }
    return this.engine.validateMove(gameState, move);
  }

  applyMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): GameState {
    if (!this.engine) {
      console.warn('⚠️ No game engine - using mock move application');
      return this.mockApplyMove(gameState, move);
    }
    return this.engine.applyMove(gameState, move);
  }

  isGameFinished(gameState: GameState): boolean {
    if (!this.engine) {
      return false; // Mock: game never finishes
    }
    return this.engine.isGameFinished(gameState);
  }

  getWinner(gameState: GameState): string | null {
    if (!this.engine) {
      return null; // Mock: no winner
    }
    return this.engine.getWinner(gameState);
  }

  getCurrentPlayer(gameState: GameState): Player {
    return gameState.players[gameState.currentPlayerIndex];
  }

  getValidMoves(gameState: GameState, playerId: string): Omit<Move, 'id' | 'timestamp'>[] {
    if (!this.engine) {
      return this.mockGetValidMoves(gameState, playerId);
    }
    return this.engine.getValidMoves(gameState, playerId);
  }

  isValidPawnMove(gameState: GameState, fromPos: Position, toPos: Position, playerId: string): boolean {
    if (!this.engine) {
      return this.mockIsValidPawnMove(fromPos, toPos);
    }
    return this.engine.isValidPawnMove(gameState, fromPos, toPos, playerId);
  }

  isValidWallPlacement(gameState: GameState, wallPos: Position, orientation: WallOrientation): boolean {
    if (!this.engine) {
      return this.mockIsValidWallPlacement(wallPos);
    }
    return this.engine.isValidWallPlacement(gameState, wallPos, orientation);
  }

  hasValidPathToGoal(gameState: GameState, playerId: string): boolean {
    if (!this.engine) {
      return true; // Mock: always has path
    }
    return this.engine.hasValidPathToGoal(gameState, playerId);
  }

  getPlayerById(gameState: GameState, playerId: string): Player | null {
    return gameState.players.find(p => p.id === playerId) || null;
  }

  getPlayerStartPosition(playerIndex: number, maxPlayers: 2 | 4): Position {
    // Standard Quoridor starting positions
    const positions = {
      2: [
        { x: 4, y: 0 }, // Bottom center
        { x: 4, y: 8 }  // Top center
      ],
      4: [
        { x: 4, y: 0 }, // Bottom center
        { x: 8, y: 4 }, // Right center
        { x: 4, y: 8 }, // Top center
        { x: 0, y: 4 }  // Left center
      ]
    };
    
    return positions[maxPlayers][playerIndex];
  }

  getPlayerGoalRow(playerIndex: number, maxPlayers: 2 | 4): number {
    if (maxPlayers === 2) {
      return playerIndex === 0 ? 8 : 0; // Player 0 goes to row 8, player 1 to row 0
    } else {
      // For 4 players: 0->8, 1->4, 2->0, 3->4 (opposite sides)
      const goals = [8, 4, 0, 4];
      return goals[playerIndex];
    }
  }

  // ==========================================
  // MOCK IMPLEMENTATIONS (TEMPORARY)
  // ==========================================

  private createMockGameState(playerIds: string[], maxPlayers: 2 | 4): GameState {
    const players: Player[] = playerIds.map((id, index) => ({
      id,
      username: `Player ${index + 1}`, // Will be updated with real usernames
      color: ['red', 'blue', 'green', 'yellow'][index] as 'red' | 'blue' | 'green' | 'yellow',
      position: this.getPlayerStartPosition(index, maxPlayers),
      wallsRemaining: maxPlayers === 2 ? 10 : 5,
      isConnected: true,
      joinedAt: new Date(),
    }));

    return {
      id: crypto.randomUUID(),
      players,
      walls: [],
      currentPlayerIndex: 0,
      status: 'playing',
      moves: [],
      createdAt: new Date(),
      startedAt: new Date(),
      maxPlayers,
    };
  }

  private mockValidateMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): boolean {
    // Basic validation - just check if it's the player's turn
    const currentPlayer = this.getCurrentPlayer(gameState);
    return move.playerId === currentPlayer.id;
  }

  private mockApplyMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): GameState {
    // Create new game state with the move applied
    const fullMove: Move = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...move,
    };

    // Advance to next player
    const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

    return {
      ...gameState,
      moves: [...gameState.moves, fullMove],
      currentPlayerIndex: nextPlayerIndex,
    };
  }

  private mockGetValidMoves(gameState: GameState, playerId: string): Omit<Move, 'id' | 'timestamp'>[] {
    const player = this.getPlayerById(gameState, playerId);
    if (!player) return [];

    // Mock: return basic adjacent moves
    const moves: Omit<Move, 'id' | 'timestamp'>[] = [];
    const { x, y } = player.position;

    // Add adjacent pawn moves
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const newX = x + dx;
      const newY = y + dy;
      if (newX >= 0 && newX <= 8 && newY >= 0 && newY <= 8) {
        moves.push({
          type: 'pawn',
          playerId,
          fromPosition: { x, y },
          toPosition: { x: newX, y: newY },
        });
      }
    }

    return moves;
  }

  private mockIsValidPawnMove(fromPos: Position, toPos: Position): boolean {
    // Mock: allow moves to adjacent squares
    const dx = Math.abs(toPos.x - fromPos.x);
    const dy = Math.abs(toPos.y - fromPos.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }

  private mockIsValidWallPlacement(wallPos: Position): boolean {
    // Mock: allow walls anywhere on the board
    return wallPos.x >= 0 && wallPos.x <= 7 && wallPos.y >= 0 && wallPos.y <= 7;
  }
}

// Singleton instance
export const gameEngineManager = new GameEngineManager(); 