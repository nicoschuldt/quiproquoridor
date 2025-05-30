import React from 'react';
import { useParams } from 'react-router-dom';

const RoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="card">
          <h1 className="text-2xl font-bold mb-4">Game Room</h1>
          <p className="text-gray-600">Room ID: {roomId}</p>
          <p className="text-sm text-gray-500 mt-4">
            🚧 Room functionality coming soon! This will show:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-500 mt-2 space-y-1">
            <li>Players in the room</li>
            <li>Ready status</li>
            <li>Start game button</li>
            <li>Room settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
