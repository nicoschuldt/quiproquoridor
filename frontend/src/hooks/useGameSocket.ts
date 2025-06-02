import { useEffect, useCallback, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import type { 
  GameState, 
  Move, 
  Position, 
  WallOrientation, 
  Player,
  ApiError 
} from '@/types';

interface UseGameSocketProps {
  roomId: string;
  onGameStarted?: (data: { gameState: GameState }) => void;
  onMoveMade?: (data: { move: Move; gameState: GameState }) => void;
  onGameFinished?: (data: { gameState: GameState; winner: Player }) => void;
  onGameStateSync?: (data: { gameState: GameState; validMoves?: Move[] }) => void;
  onInvalidMove?: (data: { error: string; originalMove: any }) => void;
  onPlayerForfeited?: (data: { playerId: string; playerName: string; gameState: GameState }) => void;
  onDisconnectionWarning?: (data: { playerId: string; playerName: string; timeoutSeconds: number }) => void;
  onReconnectionSuccess?: (data: { playerId: string; playerName: string; gameState: GameState }) => void;
  onError?: (data: { error: ApiError }) => void;
}

interface UseGameSocketReturn {
  // Connection state
  isConnected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  
  // Game actions
  startGame: () => void;
  makeMove: (move: Omit<Move, 'id' | 'timestamp'>) => void;
  requestGameState: () => void;
  joinRoom: () => void;
  leaveRoom: () => void;
  forfeitGame: () => void;
  
  // Helper methods
  makePawnMove: (from: Position, to: Position) => void;
  placeWall: (position: Position, orientation: WallOrientation) => void;
}

export const useGameSocket = ({
  roomId,
  onGameStarted,
  onMoveMade,
  onGameFinished,
  onGameStateSync,
  onInvalidMove,
  onPlayerForfeited,
  onDisconnectionWarning,
  onReconnectionSuccess,
  onError
}: UseGameSocketProps): UseGameSocketReturn => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  // Update connection status
  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  }, [isConnected]);

  // Setup event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🎮 Setting up game socket listeners for room:', roomId);

    // Set up all the event listeners
    if (onGameStarted) socket.on('game-started', onGameStarted);
    if (onMoveMade) socket.on('move-made', onMoveMade);
    if (onGameFinished) socket.on('game-finished', onGameFinished);
    if (onGameStateSync) socket.on('game-state-sync', onGameStateSync);
    if (onInvalidMove) socket.on('invalid-move', onInvalidMove);
    if (onPlayerForfeited) socket.on('player-forfeited', onPlayerForfeited);
    if (onDisconnectionWarning) socket.on('disconnection-warning', onDisconnectionWarning);
    if (onReconnectionSuccess) socket.on('reconnection-success', onReconnectionSuccess);
    if (onError) socket.on('error', onError);

    // Cleanup on unmount or dependency change
    return () => {
      console.log('🧹 Cleaning up game socket listeners');
      if (onGameStarted) socket.off('game-started', onGameStarted);
      if (onMoveMade) socket.off('move-made', onMoveMade);
      if (onGameFinished) socket.off('game-finished', onGameFinished);
      if (onGameStateSync) socket.off('game-state-sync', onGameStateSync);
      if (onInvalidMove) socket.off('invalid-move', onInvalidMove);
      if (onPlayerForfeited) socket.off('player-forfeited', onPlayerForfeited);
      if (onDisconnectionWarning) socket.off('disconnection-warning', onDisconnectionWarning);
      if (onReconnectionSuccess) socket.off('reconnection-success', onReconnectionSuccess);
      if (onError) socket.off('error', onError);
    };
  }, [socket, isConnected, roomId, onGameStarted, onMoveMade, onGameFinished, onGameStateSync, onInvalidMove, onPlayerForfeited, onDisconnectionWarning, onReconnectionSuccess, onError]);

  // Game action functions
  const startGame = useCallback(() => {
    if (!socket || !roomId) {
      console.warn('Cannot start game: no socket or roomId');
      return;
    }
    console.log('🚀 Starting game in room:', roomId);
    socket.emit('start-game', { roomId });
  }, [socket, roomId]);

  const makeMove = useCallback((move: Omit<Move, 'id' | 'timestamp'>) => {
    if (!socket || !roomId) {
      console.warn('Cannot make move: no socket or roomId');
      return;
    }
    console.log('🎯 Making move:', move);
    socket.emit('make-move', { roomId, move });
  }, [socket, roomId]);

  const requestGameState = useCallback(() => {
    if (!socket || !roomId) {
      console.warn('Cannot request game state: no socket or roomId');
      return;
    }
    console.log('📊 Requesting game state for room:', roomId);
    socket.emit('request-game-state', { roomId });
  }, [socket, roomId]);

  const joinRoom = useCallback(() => {
    if (!socket || !roomId) {
      console.warn('Cannot join room: no socket or roomId');
      return;
    }
    console.log('🚪 Joining room:', roomId);
    socket.emit('join-room', { roomId });
  }, [socket, roomId]);

  const leaveRoom = useCallback(() => {
    if (!socket || !roomId) {
      console.warn('Cannot leave room: no socket or roomId');
      return;
    }
    console.log('🚪 Leaving room:', roomId);
    socket.emit('leave-room', { roomId });
  }, [socket, roomId]);

  const forfeitGame = useCallback(() => {
    if (!socket || !roomId) {
      console.warn('Cannot forfeit game: no socket or roomId');
      return;
    }
    console.log('🏳️ Forfeiting game in room:', roomId);
    socket.emit('forfeit-game', { roomId });
  }, [socket, roomId]);

  // Convenience methods for specific move types
  const makePawnMove = useCallback((from: Position, to: Position) => {
    if (!user) {
      console.warn('Cannot make pawn move: no user');
      return;
    }
    
    const move: Omit<Move, 'id' | 'timestamp'> = {
      type: 'pawn',
      playerId: user.id,
      fromPosition: from,
      toPosition: to,
    };
    
    makeMove(move);
  }, [user, makeMove]);

  const placeWall = useCallback((position: Position, orientation: WallOrientation) => {
    if (!user) {
      console.warn('Cannot place wall: no user');
      return;
    }
    
    const move: Omit<Move, 'id' | 'timestamp'> = {
      type: 'wall',
      playerId: user.id,
      wallPosition: position,
      wallOrientation: orientation,
    };
    
    makeMove(move);
  }, [user, makeMove]);

  return {
    // Connection state
    isConnected,
    connectionStatus,
    
    // Game actions
    startGame,
    makeMove,
    requestGameState,
    joinRoom,
    leaveRoom,
    forfeitGame,
    
    // Helper methods
    makePawnMove,
    placeWall,
  };
};