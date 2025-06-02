// frontend/src/components/game/GameBoard.tsx
import React, { useState, useCallback } from 'react';
import type { Position, Move, Wall, GameState, Player, WallOrientation } from '@/types';

/**
 * GameBoard Component for Quoridor
 * 
 * Coordinate System:
 * - Pawn positions: 9x9 grid (0-8, 0-8) 
 * - Wall positions: 8x8 grid (0-7, 0-7)
 * - CSS Grid: 17x17 with alternating thick (pawn) and thin (wall) tracks
 * 
 * Wall Spanning:
 * - Horizontal walls span 3 CSS grid columns (across 2 pawn squares)
 * - Vertical walls span 3 CSS grid rows (across 2 pawn squares)
 * 
 * Grid Layout:
 * - Tracks 1,3,5,7,9,11,13,15,17: Pawn squares (1fr each)
 * - Tracks 2,4,6,8,10,12,14,16: Wall zones (8px each)
 */

interface GameBoardProps {
  gameState: GameState;
  currentPlayerId: string;
  onPawnMove: (from: Position, to: Position) => void;
  onWallPlace: (position: Position, orientation: WallOrientation) => void;
  validMoves?: Move[];
  disabled?: boolean;
}

// Coordinate conversion utilities
const gameToGrid = (pos: Position) => ({
  row: pos.y * 2 + 1,  // y coordinate maps to CSS grid row
  col: pos.x * 2 + 1   // x coordinate maps to CSS grid column
});

const gridToGame = (gridRow: number, gridCol: number): Position => ({
  x: (gridCol - 1) / 2,
  y: (gridRow - 1) / 2
});

// Helper to check if grid position is a pawn square (odd numbers)
const isPawnSquare = (row: number, col: number): boolean => {
  return row % 2 === 1 && col % 2 === 1;
};

// Helper to check if grid position is a wall zone
const isWallZone = (row: number, col: number): boolean => {
  return (row % 2 === 0 && col % 2 === 1) || (row % 2 === 1 && col % 2 === 0);
};

// Helper to determine wall orientation from grid position
const getWallOrientation = (row: number, col: number): WallOrientation | null => {
  if (row % 2 === 0 && col % 2 === 1) return 'horizontal';
  if (row % 2 === 1 && col % 2 === 0) return 'vertical';
  return null;
};

// Convert wall zone grid position to game coordinates
const wallZoneToGame = (row: number, col: number): Position | null => {
  if (row % 2 === 0 && col % 2 === 1) {
    // Horizontal wall - spans 3 columns, starts at odd column
    return { x: (col - 1) / 2, y: (row - 2) / 2 };
  }
  if (row % 2 === 1 && col % 2 === 0) {
    // Vertical wall - spans 3 rows, starts at odd row  
    return { x: (col - 2) / 2, y: (row - 1) / 2 };
  }
  return null;
};

interface PawnSquareProps {
  position: Position;
  gridRow: number;
  gridCol: number;
  player?: Player;
  isValidMove: boolean;
  isCurrentPlayer: boolean;
  onClick: () => void;
  disabled: boolean;
}

const PawnSquare: React.FC<PawnSquareProps> = ({
  position,
  gridRow,
  gridCol,
  player,
  isValidMove,
  isCurrentPlayer,
  onClick,
  disabled
}) => {
  const handleClick = useCallback(() => {
    console.log(`🎯 Pawn square clicked:`, {
      gamePosition: position,
      gridPosition: { row: gridRow, col: gridCol },
      isValidMove,
      player: player?.username || 'empty'
    });
    
    if (!disabled && isValidMove) {
      onClick();
    }
  }, [disabled, isValidMove, onClick, position, gridRow, gridCol, player]);

  const baseClasses = "aspect-square border border-gray-300 flex items-center justify-center relative transition-all duration-200 bg-amber-50";
  
  let squareClasses = baseClasses;
  if (isValidMove && !disabled) {
    squareClasses += " cursor-pointer hover:bg-green-100 hover:border-green-400";
  }
  if (isCurrentPlayer) {
    squareClasses += " ring-2 ring-yellow-400 ring-inset";
  }

  return (
    <div
      className={squareClasses}
      style={{ gridRow: gridRow, gridColumn: gridCol }}
      onClick={handleClick}
    >
      {/* Valid move indicator */}
      {isValidMove && !player && !disabled && (
        <div className="w-6 h-6 bg-green-500 rounded-full opacity-70 animate-pulse shadow-lg" />
      )}
      
      {/* Player pawn */}
      {player && (
        <div 
          className={`w-10 h-10 rounded-full border-3 border-white shadow-lg flex items-center justify-center ${
            player.color === 'red' ? 'bg-game-red' :
            player.color === 'blue' ? 'bg-game-blue' :
            player.color === 'green' ? 'bg-game-green' :
            'bg-game-yellow'
          }`}
          title={`${player.username} (${player.wallsRemaining} walls left)`}
        >
          <div className="w-4 h-4 bg-white rounded-full opacity-80"></div>
        </div>
      )}
      
      {/* Debug coordinates (remove in production) */}
      <div className="absolute top-1 left-1 text-xs text-gray-500 pointer-events-none bg-white bg-opacity-70 px-1 rounded">
        {position.x},{position.y}
      </div>
    </div>
  );
};

interface WallZoneProps {
  gamePosition: Position;
  orientation: WallOrientation;
  gridRow: number;
  gridCol: number;
  hasWall: boolean;
  isValidPlacement: boolean;
  onClick: () => void;
  disabled: boolean;
}

const WallZone: React.FC<WallZoneProps> = ({
  gamePosition,
  orientation,
  gridRow,
  gridCol,
  hasWall,
  isValidPlacement,
  onClick,
  disabled
}) => {
  const [isHovering, setIsHovering] = useState(false);

  const handleClick = useCallback(() => {
    console.log(`🧱 Wall zone clicked:`, {
      gamePosition,
      orientation,
      gridPosition: { row: gridRow, col: gridCol },
      hasWall,
      isValidPlacement
    });
    
    if (!disabled && isValidPlacement && !hasWall) {
      onClick();
    }
  }, [disabled, isValidPlacement, hasWall, onClick, gamePosition, orientation, gridRow, gridCol]);

  const isHorizontal = orientation === 'horizontal';
  const baseClasses = "transition-all duration-200 flex items-center justify-center";
  
  let wallClasses = baseClasses;
  if (isValidPlacement && !hasWall && !disabled) {
    wallClasses += " cursor-pointer hover:bg-red-200";
  }

  // Wall should span 3 grid cells (across 2 pawn squares)
  const wallStyle = isHorizontal 
    ? { 
        gridRow: gridRow, 
        gridColumn: `${gridCol} / ${gridCol + 3}`,
        minHeight: '8px'
      }
    : { 
        gridRow: `${gridRow} / ${gridRow + 3}`, 
        gridColumn: gridCol,
        minWidth: '8px'
      };

  return (
    <div
      className={wallClasses}
      style={wallStyle}
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Existing wall */}
      {hasWall && (
        <div className={`bg-gray-800 rounded-sm ${
          isHorizontal ? 'h-4 w-full' : 'w-4 h-full'
        }`} />
      )}
      
      {/* Wall preview on hover */}
      {!hasWall && isValidPlacement && !disabled && isHovering && (
        <div className={`bg-red-500 opacity-80 rounded-sm ${
          isHorizontal ? 'h-4 w-full' : 'w-4 h-full'
        }`} />
      )}
      
      {/* Valid placement indicator */}
      {!hasWall && isValidPlacement && !disabled && !isHovering && (
        <div className={`bg-red-300 opacity-50 rounded-sm ${
          isHorizontal ? 'h-3 w-full' : 'w-3 h-full'
        }`} />
      )}
    </div>
  );
};

const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  currentPlayerId,
  onPawnMove,
  onWallPlace,
  validMoves = [],
  disabled = false
}) => {
  console.log(`🎮 GameBoard render:`, {
    gameState,
    currentPlayerId,
    validMovesCount: validMoves.length,
    disabled
  });

  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  const currentPlayerPosition = currentPlayer?.position;

  // Helper functions for move validation
  const isValidPawnMove = useCallback((position: Position): boolean => {
    return validMoves.some(move => 
      move.type === 'pawn' && 
      move.toPosition?.x === position.x && 
      move.toPosition?.y === position.y
    );
  }, [validMoves]);

  const isValidWallPlacement = useCallback((position: Position, orientation: WallOrientation): boolean => {
    return validMoves.some(move =>
      move.type === 'wall' &&
      move.wallPosition?.x === position.x &&
      move.wallPosition?.y === position.y &&
      move.wallOrientation === orientation
    );
  }, [validMoves]);

  const hasWallAt = useCallback((position: Position, orientation: WallOrientation): boolean => {
    return gameState.walls.some(wall =>
      wall.position.x === position.x &&
      wall.position.y === position.y &&
      wall.orientation === orientation
    );
  }, [gameState.walls]);

  // Event handlers
  const handlePawnMove = useCallback((toPosition: Position) => {
    if (!currentPlayerPosition) {
      console.error('❌ No current player position');
      return;
    }
    
    console.log(`👤 Pawn move:`, {
      from: currentPlayerPosition,
      to: toPosition,
      player: currentPlayer?.username
    });
    
    onPawnMove(currentPlayerPosition, toPosition);
  }, [currentPlayerPosition, currentPlayer, onPawnMove]);

  const handleWallPlace = useCallback((position: Position, orientation: WallOrientation) => {
    console.log(`🧱 Wall placement:`, {
      position,
      orientation,
      player: currentPlayer?.username,
      wallsRemaining: currentPlayer?.wallsRemaining
    });
    
    onWallPlace(position, orientation);
  }, [currentPlayer, onWallPlace]);

  // Get player at specific position
  const getPlayerAt = useCallback((position: Position): Player | undefined => {
    return gameState.players.find(player =>
      player.position.x === position.x && player.position.y === position.y
    );
  }, [gameState.players]);

  // Render grid cells (17x17)
  const renderGridCells = () => {
    const cells = [];
    
    for (let row = 1; row <= 17; row++) {
      for (let col = 1; col <= 17; col++) {
        const key = `${row}-${col}`;
        
        if (isPawnSquare(row, col)) {
          // Pawn square
          const gamePos = gridToGame(row, col);
          const player = getPlayerAt(gamePos);
          const isValidMove = isValidPawnMove(gamePos);
          const isCurrentPlayer = player?.id === currentPlayerId;
          
          cells.push(
            <PawnSquare
              key={key}
              position={gamePos}
              gridRow={row}
              gridCol={col}
              player={player}
              isValidMove={isValidMove}
              isCurrentPlayer={isCurrentPlayer}
              onClick={() => handlePawnMove(gamePos)}
              disabled={disabled}
            />
          );
        } else if (isWallZone(row, col)) {
          // Only create wall zones at the starting position of each wall
          const orientation = getWallOrientation(row, col);
          
          // For horizontal walls: only at odd columns (1,3,5,7,9,11,13,15)
          // For vertical walls: only at odd rows (1,3,5,7,9,11,13,15)
          const shouldCreateWallZone = 
            (orientation === 'horizontal' && col % 2 === 1) ||
            (orientation === 'vertical' && row % 2 === 1);
          
          if (shouldCreateWallZone) {
            const gamePos = wallZoneToGame(row, col);
            
            if (orientation && gamePos) {
              const hasWall = hasWallAt(gamePos, orientation);
              const isValidPlacement = isValidWallPlacement(gamePos, orientation);
              
              cells.push(
                <WallZone
                  key={key}
                  gamePosition={gamePos}
                  orientation={orientation}
                  gridRow={row}
                  gridCol={col}
                  hasWall={hasWall}
                  isValidPlacement={isValidPlacement}
                  onClick={() => handleWallPlace(gamePos, orientation)}
                  disabled={disabled}
                />
              );
            }
          }
        } else {
          // Empty intersection space - only render if not covered by a wall zone
          const isHorizontalWallRow = row % 2 === 0;
          const isVerticalWallCol = col % 2 === 0;
          const isCorner = row % 2 === 0 && col % 2 === 0;
          
          // Don't render cells that will be covered by wall zones
          const isCoveredByHorizontalWall = isHorizontalWallRow && col % 2 === 0 && col > 1;
          const isCoveredByVerticalWall = isVerticalWallCol && row % 2 === 0 && row > 1;
          
          if (!isCoveredByHorizontalWall && !isCoveredByVerticalWall) {
            cells.push(
              <div
                key={key}
                className={`${isCorner ? 'bg-gray-200' : 'bg-gray-100'}`}
                style={{ gridRow: row, gridColumn: col }}
              />
            );
          }
        }
      }
    }
    
    return cells;
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      {/* Game info */}
      <div className="mb-4 text-center">
        <h3 className="text-lg font-semibold mb-2">
          Current Turn: {currentPlayer?.username || 'Unknown'}
        </h3>
        <div className="flex justify-center space-x-4 text-sm">
          {gameState.players.map(player => (
            <div key={player.id} className={`flex items-center space-x-1 ${
              player.id === currentPlayerId ? 'font-bold' : ''
            }`}>
              <div className={`w-4 h-4 rounded-full ${
                player.color === 'red' ? 'bg-game-red' :
                player.color === 'blue' ? 'bg-game-blue' :
                player.color === 'green' ? 'bg-game-green' :
                'bg-game-yellow'
              }`} />
              <span>{player.username}: {player.wallsRemaining} walls</span>
            </div>
          ))}
        </div>
      </div>

      {/* Game board */}
      <div 
        className="game-board aspect-square bg-white border-2 border-gray-400 relative"
        style={{
          display: 'grid',
          // Alternating pattern: pawn squares (1fr) and wall zones (8px)
          gridTemplateColumns: '1fr 8px 1fr 8px 1fr 8px 1fr 8px 1fr 8px 1fr 8px 1fr 8px 1fr 8px 1fr',
          gridTemplateRows: '1fr 8px 1fr 8px 1fr 8px 1fr 8px 1fr 8px 1fr 8px 1fr 8px 1fr 8px 1fr',
        }}
      >
        {renderGridCells()}
      </div>

      {/* Debug info */}
      <div className="mt-4 text-xs text-gray-500">
        <div>Valid moves: {validMoves.length}</div>
        <div>Walls placed: {gameState.walls.length}</div>
        <div>Current player ID: {currentPlayerId}</div>
      </div>
    </div>
  );
};

export default GameBoard;