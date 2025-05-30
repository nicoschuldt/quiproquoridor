import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { roomApi } from '../services/api';
import type { UserRoomStatus } from '@/types';

interface ActiveGameBannerProps {
  onRoomChange?: (roomStatus: UserRoomStatus | null) => void;
}

const ActiveGameBanner: React.FC<ActiveGameBannerProps> = ({ onRoomChange }) => {
  const [activeRoom, setActiveRoom] = useState<UserRoomStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkActiveRoom = async () => {
    try {
      setError(null);
      setLoading(true);
      console.log('🔍 Checking for active rooms...');
      
      const roomStatus = await roomApi.getCurrentRoom();
      console.log('📡 Room status response:', roomStatus);
      
      setActiveRoom(roomStatus);
      onRoomChange?.(roomStatus);
      
      if (roomStatus) {
        console.log(`✅ Found active room: ${roomStatus.roomId} (${roomStatus.roomStatus})`);
      } else {
        console.log('✅ No active room found');
      }
    } catch (err: any) {
      console.error('❌ Error checking active room:', err);
      setError(err.message || 'Failed to check room status');
      setActiveRoom(null);
      onRoomChange?.(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkActiveRoom();
    
    // **ENHANCEMENT**: Refresh every 30 seconds to keep in sync
    const interval = setInterval(checkActiveRoom, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-blue-700">Checking for active games...</span>
        </div>
      </div>
    );
  }

  if (error || !activeRoom) {
    return null; // Don't show anything if no active room or error
  }

  const isGame = activeRoom.roomStatus === 'playing';
  const roomPath = isGame ? `/game/${activeRoom.roomId}` : `/room/${activeRoom.roomId}`;

  return (
    <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6 rounded-r-lg shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {isGame ? (
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">🎮</span>
              </div>
            ) : (
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">👥</span>
              </div>
            )}
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              {isGame ? 'Game in Progress' : 'Room Waiting'}
              {activeRoom.isHost && ' (Host)'}
            </h3>
            <p className="text-sm text-green-700">
              {isGame 
                ? 'You have an active game waiting for you!' 
                : 'You\'re in a room lobby waiting for players.'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={checkActiveRoom}
            className="text-green-600 hover:text-green-700 p-1 rounded"
            title="Refresh status"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <Link
            to={roomPath}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
          >
            {isGame ? 'Continue Game' : 'Join Room'}
            <span className="ml-2">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ActiveGameBanner; 