// MiniGameBoard.tsx
import React from 'react';

interface MiniGameBoardProps {
  boardThemeClass?: string;
}

const MiniGameBoard: React.FC<MiniGameBoardProps> = ({ boardThemeClass = '' }) => {
  const squares = Array.from({ length: 81 }, (_, i) => (
    <div key={i} className="pawn-square" />
  ));

  return (
    <div className={`game-board mini-game-board ${boardThemeClass}`}>
      {squares}
    </div>
  );
};

export default MiniGameBoard;
