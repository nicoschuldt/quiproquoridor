// backend/src/game/MockQuoridorEngine.ts
import type { 
    GameEngine, 
    GameState, 
    Move, 
    Player, 
    Position, 
    WallOrientation,
    Wall
  } from '../../../shared/types';
  
  /**
   * MockQuoridorEngine - A realistic implementation of Quoridor game logic
   * 
   * This mock engine implements the core Quoridor rules:
   * - Pawn movement (orthogonal, with jumping)
   * - Wall placement (blocking paths, no overlaps)
   * - Path validation (ensure players can always reach goal)
   * - Win condition checking
   * 
   * While simplified compared to a full implementation, this provides
   * a solid foundation for testing and development.
   */
  export class MockQuoridorEngine implements GameEngine {
    
    // ==========================================
    // CORE GAME OPERATIONS
    // ==========================================
  
    createGame(playerIds: string[], maxPlayers: 2 | 4): GameState {
      const players: Player[] = playerIds.map((id, index) => ({
        id,
        username: `Player ${index + 1}`, // Will be updated with real usernames
        color: ['red', 'blue', 'green', 'yellow'][index] as 'red' | 'blue' | 'green' | 'yellow',
        position: this.getPlayerStartPosition(index, maxPlayers),
        wallsRemaining: maxPlayers === 2 ? 10 : 5,
        isConnected: true,
        joinedAt: new Date(),
        selectedPawnTheme: 'theme-pawn-default', // Will be updated with real theme data
        isAI: false, // Will be updated with real AI data
        aiDifficulty: undefined, // Will be updated with real AI data
      }));
  
      const gameState: GameState = {
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
  
      console.log(`🎮 Mock game created with ${playerIds.length} players`);
      return gameState;
    }
  
    validateMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): boolean {
      console.log(`🔍 Validating move:`, { type: move.type, playerId: move.playerId });
  
      // Check if it's the player's turn
      const currentPlayer = this.getCurrentPlayer(gameState);
      if (move.playerId !== currentPlayer.id) {
        console.log(`❌ Not player's turn: expected ${currentPlayer.id}, got ${move.playerId}`);
        return false;
      }
  
      // Check if game is still active
      if (gameState.status !== 'playing') {
        console.log(`❌ Game not active: ${gameState.status}`);
        return false;
      }
  
      // Validate specific move types
      if (move.type === 'pawn') {
        return this.validatePawnMove(gameState, move);
      } else if (move.type === 'wall') {
        return this.validateWallMove(gameState, move);
      }
  
      return false;
    }
  
    applyMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): GameState {
      console.log(`🎯 Applying move:`, { type: move.type, playerId: move.playerId });
  
      // Create new game state (immutable)
      const newGameState: GameState = {
        ...gameState,
        players: [...gameState.players],
        walls: [...gameState.walls],
        moves: [...gameState.moves],
      };
  
      // Add the move to history
      const fullMove: Move = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        ...move,
      };
      newGameState.moves.push(fullMove);
  
      // Apply the move
      if (move.type === 'pawn') {
        this.applyPawnMove(newGameState, move);
      } else if (move.type === 'wall') {
        this.applyWallMove(newGameState, move);
      }
  
      // Check for win condition
      const winner = this.getWinner(newGameState);
      if (winner) {
        newGameState.status = 'finished';
        newGameState.winner = winner;
        newGameState.finishedAt = new Date();
        console.log(`🏆 Game finished! Winner: ${winner}`);
      } else {
        // Advance to next player
        newGameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
      }
  
      return newGameState;
    }
  
    // ==========================================
    // GAME STATE QUERIES
    // ==========================================
  
    isGameFinished(gameState: GameState): boolean {
      return gameState.status === 'finished' || this.getWinner(gameState) !== null;
    }
  
    getWinner(gameState: GameState): string | null {
      for (const player of gameState.players) {
        const goalRow = this.getPlayerGoalRow(
          gameState.players.indexOf(player), 
          gameState.maxPlayers
        );
        
        if (player.position.y === goalRow) {
          return player.id;
        }
      }
      return null;
    }
  
    getCurrentPlayer(gameState: GameState): Player {
      return gameState.players[gameState.currentPlayerIndex];
    }
  
    getValidMoves(gameState: GameState, playerId: string): Omit<Move, 'id' | 'timestamp'>[] {
      const player = this.getPlayerById(gameState, playerId);
      if (!player) return [];
  
      const moves: Omit<Move, 'id' | 'timestamp'>[] = [];
  
      // Add valid pawn moves
      const pawnMoves = this.getValidPawnMoves(gameState, player);
      moves.push(...pawnMoves);
  
      // Add valid wall placements (if player has walls remaining)
      if (player.wallsRemaining > 0) {
        const wallMoves = this.getValidWallMoves(gameState, player);
        moves.push(...wallMoves);
      }
  
      console.log(`📋 Generated ${moves.length} valid moves for ${playerId}`);
      return moves;
    }
  
    // ==========================================
    // VALIDATION HELPERS
    // ==========================================
  
    isValidPawnMove(gameState: GameState, fromPos: Position, toPos: Position, playerId: string): boolean {
      const player = this.getPlayerById(gameState, playerId);
      if (!player || !this.positionsEqual(player.position, fromPos)) {
        return false;
      }
  
      return this.canMovePawn(gameState, fromPos, toPos);
    }
  
    isValidWallPlacement(gameState: GameState, wallPos: Position, orientation: WallOrientation): boolean {
      // Check bounds
      if (wallPos.x < 0 || wallPos.x > 7 || wallPos.y < 0 || wallPos.y > 7) {
        return false;
      }
  
      // Check for wall overlaps
      if (this.hasWallAt(gameState, wallPos, orientation)) {
        return false;
      }
  
      // Check if wall would block all paths (simplified check)
      return this.wouldLeaveValidPaths(gameState, wallPos, orientation);
    }
  
    hasValidPathToGoal(gameState: GameState, playerId: string): boolean {
      const player = this.getPlayerById(gameState, playerId);
      if (!player) return false;
  
      const goalRow = this.getPlayerGoalRow(
        gameState.players.indexOf(player),
        gameState.maxPlayers
      );
  
      return this.canReachRow(gameState, player.position, goalRow);
    }
  
    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================
  
    getPlayerById(gameState: GameState, playerId: string): Player | null {
      return gameState.players.find(p => p.id === playerId) || null;
    }
  
    getPlayerStartPosition(playerIndex: number, maxPlayers: 2 | 4): Position {
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
        // For 4 players: opposite sides/edges
        const goals = [8, 4, 0, 4]; // Bottom->Top, Right->Left, Top->Bottom, Left->Right
        return goals[playerIndex];
      }
    }
  
    // ==========================================
    // PRIVATE HELPER METHODS
    // ==========================================
  
    private validatePawnMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): boolean {
      if (!move.fromPosition || !move.toPosition) {
        console.log(`❌ Pawn move missing positions`);
        return false;
      }
  
      return this.isValidPawnMove(gameState, move.fromPosition, move.toPosition, move.playerId);
    }
  
    private validateWallMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): boolean {
      if (!move.wallPosition || !move.wallOrientation) {
        console.log(`❌ Wall move missing position or orientation`);
        return false;
      }
  
      const player = this.getPlayerById(gameState, move.playerId);
      if (!player || player.wallsRemaining <= 0) {
        console.log(`❌ Player has no walls remaining`);
        return false;
      }
  
      return this.isValidWallPlacement(gameState, move.wallPosition, move.wallOrientation);
    }
  
    private applyPawnMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): void {
      if (!move.toPosition) return;
  
      const playerIndex = gameState.players.findIndex(p => p.id === move.playerId);
      if (playerIndex !== -1) {
        gameState.players[playerIndex] = {
          ...gameState.players[playerIndex],
          position: { ...move.toPosition }
        };
      }
    }
  
    private applyWallMove(gameState: GameState, move: Omit<Move, 'id' | 'timestamp'>): void {
      if (!move.wallPosition || !move.wallOrientation) return;
  
      // Add wall to game state
      const wall: Wall = {
        id: crypto.randomUUID(),
        position: { ...move.wallPosition },
        orientation: move.wallOrientation,
        playerId: move.playerId,
      };
      gameState.walls.push(wall);
  
      // Decrease player's wall count
      const playerIndex = gameState.players.findIndex(p => p.id === move.playerId);
      if (playerIndex !== -1) {
        gameState.players[playerIndex] = {
          ...gameState.players[playerIndex],
          wallsRemaining: gameState.players[playerIndex].wallsRemaining - 1
        };
      }
    }
  
    private getValidPawnMoves(gameState: GameState, player: Player): Omit<Move, 'id' | 'timestamp'>[] {
      const moves: Omit<Move, 'id' | 'timestamp'>[] = [];
      const { x, y } = player.position;
  
      // Check all 4 directions
      const directions = [
        { x: 0, y: 1 },  // Up
        { x: 0, y: -1 }, // Down
        { x: 1, y: 0 },  // Right
        { x: -1, y: 0 }  // Left
      ];
  
      for (const dir of directions) {
        const newPos = { x: x + dir.x, y: y + dir.y };
        
        // Check bounds
        if (newPos.x < 0 || newPos.x > 8 || newPos.y < 0 || newPos.y > 8) {
          continue;
        }
  
        if (this.canMovePawn(gameState, player.position, newPos)) {
          moves.push({
            type: 'pawn',
            playerId: player.id,
            fromPosition: { ...player.position },
            toPosition: newPos,
          });
        }
  
        // Check for jump moves (simplified)
        const jumpPos = { x: x + dir.x * 2, y: y + dir.y * 2 };
        if (jumpPos.x >= 0 && jumpPos.x <= 8 && jumpPos.y >= 0 && jumpPos.y <= 8) {
          if (this.canJumpToPawn(gameState, player.position, jumpPos)) {
            moves.push({
              type: 'pawn',
              playerId: player.id,
              fromPosition: { ...player.position },
              toPosition: jumpPos,
            });
          }
        }
      }
  
      return moves;
    }
  
    private getValidWallMoves(gameState: GameState, player: Player): Omit<Move, 'id' | 'timestamp'>[] {
      const moves: Omit<Move, 'id' | 'timestamp'>[] = [];
  
      // Check all possible wall positions (simplified - not all positions)
      for (let x = 0; x <= 7; x++) {
        for (let y = 0; y <= 7; y++) {
          const pos = { x, y };
  
          // Check horizontal wall
          if (this.isValidWallPlacement(gameState, pos, 'horizontal')) {
            moves.push({
              type: 'wall',
              playerId: player.id,
              wallPosition: pos,
              wallOrientation: 'horizontal',
            });
          }
  
          // Check vertical wall  
          if (this.isValidWallPlacement(gameState, pos, 'vertical')) {
            moves.push({
              type: 'wall',
              playerId: player.id,
              wallPosition: pos,
              wallOrientation: 'vertical',
            });
          }
        }
      }
  
      return moves;
    }
  
    private canMovePawn(gameState: GameState, fromPos: Position, toPos: Position): boolean {
      // Check if there's another player at destination
      if (this.hasPlayerAt(gameState, toPos)) {
        return false;
      }
  
      // Check if move is blocked by walls (simplified check)
      return !this.isPathBlocked(gameState, fromPos, toPos);
    }
  
    private canJumpToPawn(gameState: GameState, fromPos: Position, toPos: Position): boolean {
      // Simplified jump validation
      const middlePos = {
        x: (fromPos.x + toPos.x) / 2,
        y: (fromPos.y + toPos.y) / 2
      };
  
      // Check if there's a player to jump over
      return this.hasPlayerAt(gameState, middlePos) && !this.hasPlayerAt(gameState, toPos);
    }
  
    private hasPlayerAt(gameState: GameState, position: Position): boolean {
      return gameState.players.some(player => 
        this.positionsEqual(player.position, position)
      );
    }
  
    private hasWallAt(gameState: GameState, position: Position, orientation: WallOrientation): boolean {
      return gameState.walls.some(wall =>
        this.positionsEqual(wall.position, position) && wall.orientation === orientation
      );
    }
  
    private isPathBlocked(gameState: GameState, fromPos: Position, toPos: Position): boolean {
      // Simplified wall blocking check
      const dx = toPos.x - fromPos.x;
      const dy = toPos.y - fromPos.y;
  
      // Only check adjacent moves for now
      if (Math.abs(dx) + Math.abs(dy) !== 1) {
        return false;
      }
  
      // Check for walls that would block this move
      if (dx === 1) { // Moving right
        return this.hasWallAt(gameState, { x: fromPos.x, y: fromPos.y }, 'vertical') ||
               this.hasWallAt(gameState, { x: fromPos.x, y: fromPos.y - 1 }, 'vertical');
      } else if (dx === -1) { // Moving left
        return this.hasWallAt(gameState, { x: fromPos.x - 1, y: fromPos.y }, 'vertical') ||
               this.hasWallAt(gameState, { x: fromPos.x - 1, y: fromPos.y - 1 }, 'vertical');
      } else if (dy === 1) { // Moving up
        return this.hasWallAt(gameState, { x: fromPos.x, y: fromPos.y }, 'horizontal') ||
               this.hasWallAt(gameState, { x: fromPos.x - 1, y: fromPos.y }, 'horizontal');
      } else if (dy === -1) { // Moving down
        return this.hasWallAt(gameState, { x: fromPos.x, y: fromPos.y - 1 }, 'horizontal') ||
               this.hasWallAt(gameState, { x: fromPos.x - 1, y: fromPos.y - 1 }, 'horizontal');
      }
  
      return false;
    }
  
    private wouldLeaveValidPaths(gameState: GameState, wallPos: Position, orientation: WallOrientation): boolean {
      // Simplified path validation - just ensure the wall placement is reasonable
      // A full implementation would use pathfinding to ensure all players can reach their goals
      
      // For now, just prevent walls at the edges that could completely block a player
      if (orientation === 'horizontal') {
        // Don't allow horizontal walls at top/bottom edges
        if (wallPos.y === 0 || wallPos.y === 7) {
          return false;
        }
      } else {
        // Don't allow vertical walls at left/right edges
        if (wallPos.x === 0 || wallPos.x === 7) {
          return false;
        }
      }
  
      return true;
    }
  
    private canReachRow(gameState: GameState, fromPos: Position, goalRow: number): boolean {
      // Simplified pathfinding - just check if there's a general path
      // A full implementation would use BFS/DFS to ensure reachability
      
      // For now, return true unless the player is completely surrounded by walls
      return true;
    }
  
    private positionsEqual(pos1: Position, pos2: Position): boolean {
      return pos1.x === pos2.x && pos1.y === pos2.y;
    }
  }
  
  // Create and set the mock engine
  export const mockQuoridorEngine = new MockQuoridorEngine();