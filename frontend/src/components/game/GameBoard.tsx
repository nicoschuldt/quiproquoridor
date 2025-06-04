// frontend/src/components/game/GameBoard.tsx
import React, { useState, useCallback } from 'react';
import type { Position, Move, Wall, GameState, Player, WallOrientation } from '@/types';
import { getSafePawnClasses, getSafePawnImagePath } from '@/utils/themeUtils';

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
  boardTheme?: string; // CSS class for board theme
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

// Calculate clockwise wave delay for smooth animation
const getClockwiseDelay = (position: Position): number => {
  const { x, y } = position;
  // Create a clockwise spiral pattern starting from center
  const centerX = 4; // Center of 9x9 grid (0-8)
  const centerY = 4;
  
  // Calculate distance from center and angle
  const dx = x - centerX;
  const dy = y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  // Convert angle to 0-1 range and combine with distance for spiral effect
  const normalizedAngle = (angle + Math.PI) / (2 * Math.PI);
  const spiralDelay = (normalizedAngle + distance * 0.3) % 1;
  
  // Return delay in seconds (0 to 2 seconds for smooth waves)
  return spiralDelay * 2;
};

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
      player: player?.username || 'empty',
      imagePath: player ? getSafePawnImagePath(player) : 'none'
    });
    
    if (!disabled && isValidMove) {
      onClick();
    }
  }, [disabled, isValidMove, onClick, position, gridRow, gridCol, player]);

  const baseClasses = "pawn-square aspect-square flex items-center justify-center relative";
  
  let squareClasses = baseClasses;
  if (isValidMove && !disabled) {
    squareClasses += " cursor-pointer valid-move";
  }
  if (isCurrentPlayer) {
    squareClasses += " ring-2 ring-yellow-400 ring-inset";
  }

  // Calculate animation delay for clockwise wave effect
  const animationDelay = isValidMove && !disabled ? getClockwiseDelay(position) : 0;
  
  const squareStyle: React.CSSProperties = {
    gridRow: gridRow,
    gridColumn: gridCol,
    ...(isValidMove && !disabled && {
      animationDelay: `${animationDelay}s`
    })
  };

  return (
    <div
      className={squareClasses}
      style={squareStyle}
      onClick={handleClick}
    >
      {/* Player pawn with dynamic theme */}
      {player && (
        <img 
          src={getSafePawnImagePath(player)}
          alt={`${player.username} pawn`}
          className={getSafePawnClasses(player)}
          title={`${player.username} (${player.wallsRemaining} walls left)`}
        />
      )}
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

  const handleMouseEnter = useCallback(() => {
    if (!disabled && isValidPlacement && !hasWall) {
      setIsHovering(true);
    }
  }, [disabled, isValidPlacement, hasWall]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  const isHorizontal = orientation === 'horizontal';
  const baseClasses = "transition-all duration-100 flex items-center justify-center";
  
  let wallClasses = baseClasses;
  if (isValidPlacement && !hasWall && !disabled) {
    wallClasses += " cursor-pointer";
  }

  // Wall should span 3 grid cells (across 2 pawn squares)
  const wallStyle = isHorizontal 
    ? { 
        gridRow: gridRow, 
        gridColumn: `${gridCol} / ${gridCol + 3}`,
        minHeight: '10px'
      }
    : { 
        gridRow: `${gridRow} / ${gridRow + 3}`, 
        gridColumn: gridCol,
        minWidth: '10px'
      };

  return (
    <div
      className={wallClasses}
      style={wallStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Existing wall */}
      {hasWall && (
        <div className="wall h-full w-full" />
      )}
      
      {/* Wall preview on hover - fill the entire zone */}
      {!hasWall && isValidPlacement && !disabled && isHovering && (
        <div className="wall-preview h-full w-full" />
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
  disabled = false,
  boardTheme
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
    <div className="w-full p-2 sm:p-4">
      {/* Game info */}
      <div className="mb-2 sm:mb-4 text-center">
        <div className="flex justify-center space-x-2 sm:space-x-4 text-xs sm:text-sm">
          {gameState.players.map(player => (
            <div key={player.id} className={`flex items-center space-x-1 ${
              player.id === currentPlayerId ? 'font-bold' : ''
            }`}>
              <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${
                player.color === 'red' ? 'bg-red-500' :
                player.color === 'blue' ? 'bg-blue-500' :
                player.color === 'green' ? 'bg-green-500' :
                'bg-yellow-500'
              }`} />
              <span className="hidden xs:inline">{player.username}: {player.wallsRemaining} walls</span>
              <span className="xs:hidden">{player.wallsRemaining}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Game board container with responsive sizing */}
      <div className="flex justify-center">
        <div className="board-wrapper p-4 sm:p-6 lg:p-8">
          <div 
            className={`game-board aspect-square relative max-w-[90vw] max-h-[90vh] w-full 
                       sm:max-w-[min(90vw,90vh)] lg:max-w-4xl xl:max-w-5xl ${boardTheme || ''}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr',
              gridTemplateRows: '1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr calc(var(--wall-size, 1rem)) 1fr',
              '--board-size': 'min(90vw, 90vh)',
              '--wall-size': 'calc(var(--board-size) / 60)',
            } as React.CSSProperties}
          >
            {renderGridCells()}
          </div>
        </div>
      </div>

      {/* Debug info - responsive */}
      <div className="mt-2 sm:mt-4 text-xs text-gray-500 text-center">
        <div className="hidden sm:block">Valid moves: {validMoves.length}</div>
        <div className="hidden sm:block">Walls placed: {gameState.walls.length}</div>
        <div className="hidden lg:block">Current player ID: {currentPlayerId}</div>
      </div>
    </div>
  );
};

export default GameBoard;