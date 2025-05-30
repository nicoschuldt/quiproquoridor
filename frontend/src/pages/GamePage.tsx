import React from 'react';
import { useParams } from 'react-router-dom';

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 card">
            <h1 className="text-2xl font-bold mb-4">Quoridor Game</h1>
            <div className="aspect-square bg-green-100 border-2 border-green-200 rounded-lg flex items-center justify-center">
              <p className="text-green-600 font-medium">9x9 Game Board Goes Here</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-semibold mb-2">Game Info</h3>
              <p className="text-sm text-gray-600">Room: {roomId}</p>
              <p className="text-sm text-gray-600">Turn: Player 1</p>
              <p className="text-sm text-gray-600">Walls left: 10</p>
            </div>
            
            <div className="card">
              <h3 className="font-semibold mb-2">Players</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm">Player 1</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">Player 2</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mt-4 text-center">
          🚧 Game functionality coming soon! This will include the full Quoridor game board and controls.
        </p>
      </div>
    </div>
  );
};

export default GamePage;
