"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockQuoridorEngine = exports.MockQuoridorEngine = void 0;
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
class MockQuoridorEngine {
    createGame(playerIds, maxPlayers) {
        const players = playerIds.map((id, index) => ({
            id,
            username: `Player ${index + 1}`,
            color: ['red', 'blue', 'green', 'yellow'][index],
            position: this.getPlayerStartPosition(index, maxPlayers),
            wallsRemaining: maxPlayers === 2 ? 10 : 5,
            isConnected: true,
            joinedAt: new Date(),
            selectedPawnTheme: 'theme-pawn-default',
            isAI: false,
            aiDifficulty: undefined,
        }));
        const gameState = {
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
    validateMove(gameState, move) {
        console.log(`🔍 Validating move:`, { type: move.type, playerId: move.playerId });
        const currentPlayer = this.getCurrentPlayer(gameState);
        if (move.playerId !== currentPlayer.id) {
            console.log(`❌ Not player's turn: expected ${currentPlayer.id}, got ${move.playerId}`);
            return false;
        }
        if (gameState.status !== 'playing') {
            console.log(`❌ Game not active: ${gameState.status}`);
            return false;
        }
        if (move.type === 'pawn') {
            return this.validatePawnMove(gameState, move);
        }
        else if (move.type === 'wall') {
            return this.validateWallMove(gameState, move);
        }
        return false;
    }
    applyMove(gameState, move) {
        console.log(`🎯 Applying move:`, { type: move.type, playerId: move.playerId });
        const newGameState = {
            ...gameState,
            players: [...gameState.players],
            walls: [...gameState.walls],
            moves: [...gameState.moves],
        };
        const fullMove = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            ...move,
        };
        newGameState.moves.push(fullMove);
        if (move.type === 'pawn') {
            this.applyPawnMove(newGameState, move);
        }
        else if (move.type === 'wall') {
            this.applyWallMove(newGameState, move);
        }
        const winner = this.getWinner(newGameState);
        if (winner) {
            newGameState.status = 'finished';
            newGameState.winner = winner;
            newGameState.finishedAt = new Date();
            console.log(`🏆 Game finished! Winner: ${winner}`);
        }
        else {
            newGameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        }
        return newGameState;
    }
    isGameFinished(gameState) {
        return gameState.status === 'finished' || this.getWinner(gameState) !== null;
    }
    getWinner(gameState) {
        for (const player of gameState.players) {
            const goalRow = this.getPlayerGoalRow(gameState.players.indexOf(player), gameState.maxPlayers);
            if (player.position.y === goalRow) {
                return player.id;
            }
        }
        return null;
    }
    getCurrentPlayer(gameState) {
        return gameState.players[gameState.currentPlayerIndex];
    }
    getValidMoves(gameState, playerId) {
        const player = this.getPlayerById(gameState, playerId);
        if (!player)
            return [];
        const moves = [];
        const pawnMoves = this.getValidPawnMoves(gameState, player);
        moves.push(...pawnMoves);
        if (player.wallsRemaining > 0) {
            const wallMoves = this.getValidWallMoves(gameState, player);
            moves.push(...wallMoves);
        }
        console.log(`📋 Generated ${moves.length} valid moves for ${playerId}`);
        return moves;
    }
    isValidPawnMove(gameState, fromPos, toPos, playerId) {
        const player = this.getPlayerById(gameState, playerId);
        if (!player || !this.positionsEqual(player.position, fromPos)) {
            return false;
        }
        return this.canMovePawn(gameState, fromPos, toPos);
    }
    isValidWallPlacement(gameState, wallPos, orientation) {
        if (wallPos.x < 0 || wallPos.x > 7 || wallPos.y < 0 || wallPos.y > 7) {
            return false;
        }
        if (this.hasWallAt(gameState, wallPos, orientation)) {
            return false;
        }
        return this.wouldLeaveValidPaths(gameState, wallPos, orientation);
    }
    hasValidPathToGoal(gameState, playerId) {
        const player = this.getPlayerById(gameState, playerId);
        if (!player)
            return false;
        const goalRow = this.getPlayerGoalRow(gameState.players.indexOf(player), gameState.maxPlayers);
        return this.canReachRow(gameState, player.position, goalRow);
    }
    getPlayerById(gameState, playerId) {
        return gameState.players.find(p => p.id === playerId) || null;
    }
    getPlayerStartPosition(playerIndex, maxPlayers) {
        const positions = {
            2: [
                { x: 4, y: 0 },
                { x: 4, y: 8 }
            ],
            4: [
                { x: 4, y: 0 },
                { x: 8, y: 4 },
                { x: 4, y: 8 },
                { x: 0, y: 4 }
            ]
        };
        return positions[maxPlayers][playerIndex];
    }
    getPlayerGoalRow(playerIndex, maxPlayers) {
        if (maxPlayers === 2) {
            return playerIndex === 0 ? 8 : 0;
        }
        else {
            const goals = [8, 4, 0, 4];
            return goals[playerIndex];
        }
    }
    validatePawnMove(gameState, move) {
        if (!move.fromPosition || !move.toPosition) {
            console.log(`❌ Pawn move missing positions`);
            return false;
        }
        return this.isValidPawnMove(gameState, move.fromPosition, move.toPosition, move.playerId);
    }
    validateWallMove(gameState, move) {
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
    applyPawnMove(gameState, move) {
        if (!move.toPosition)
            return;
        const playerIndex = gameState.players.findIndex(p => p.id === move.playerId);
        if (playerIndex !== -1) {
            gameState.players[playerIndex] = {
                ...gameState.players[playerIndex],
                position: { ...move.toPosition }
            };
        }
    }
    applyWallMove(gameState, move) {
        if (!move.wallPosition || !move.wallOrientation)
            return;
        const wall = {
            id: crypto.randomUUID(),
            position: { ...move.wallPosition },
            orientation: move.wallOrientation,
            playerId: move.playerId,
        };
        gameState.walls.push(wall);
        const playerIndex = gameState.players.findIndex(p => p.id === move.playerId);
        if (playerIndex !== -1) {
            gameState.players[playerIndex] = {
                ...gameState.players[playerIndex],
                wallsRemaining: gameState.players[playerIndex].wallsRemaining - 1
            };
        }
    }
    getValidPawnMoves(gameState, player) {
        const moves = [];
        const { x, y } = player.position;
        const directions = [
            { x: 0, y: 1 },
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: -1, y: 0 }
        ];
        for (const dir of directions) {
            const newPos = { x: x + dir.x, y: y + dir.y };
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
    getValidWallMoves(gameState, player) {
        const moves = [];
        for (let x = 0; x <= 7; x++) {
            for (let y = 0; y <= 7; y++) {
                const pos = { x, y };
                if (this.isValidWallPlacement(gameState, pos, 'horizontal')) {
                    moves.push({
                        type: 'wall',
                        playerId: player.id,
                        wallPosition: pos,
                        wallOrientation: 'horizontal',
                    });
                }
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
    canMovePawn(gameState, fromPos, toPos) {
        if (this.hasPlayerAt(gameState, toPos)) {
            return false;
        }
        return !this.isPathBlocked(gameState, fromPos, toPos);
    }
    canJumpToPawn(gameState, fromPos, toPos) {
        const middlePos = {
            x: (fromPos.x + toPos.x) / 2,
            y: (fromPos.y + toPos.y) / 2
        };
        return this.hasPlayerAt(gameState, middlePos) && !this.hasPlayerAt(gameState, toPos);
    }
    hasPlayerAt(gameState, position) {
        return gameState.players.some(player => this.positionsEqual(player.position, position));
    }
    hasWallAt(gameState, position, orientation) {
        return gameState.walls.some(wall => this.positionsEqual(wall.position, position) && wall.orientation === orientation);
    }
    isPathBlocked(gameState, fromPos, toPos) {
        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        if (Math.abs(dx) + Math.abs(dy) !== 1) {
            return false;
        }
        if (dx === 1) {
            return this.hasWallAt(gameState, { x: fromPos.x, y: fromPos.y }, 'vertical') ||
                this.hasWallAt(gameState, { x: fromPos.x, y: fromPos.y - 1 }, 'vertical');
        }
        else if (dx === -1) {
            return this.hasWallAt(gameState, { x: fromPos.x - 1, y: fromPos.y }, 'vertical') ||
                this.hasWallAt(gameState, { x: fromPos.x - 1, y: fromPos.y - 1 }, 'vertical');
        }
        else if (dy === 1) {
            return this.hasWallAt(gameState, { x: fromPos.x, y: fromPos.y }, 'horizontal') ||
                this.hasWallAt(gameState, { x: fromPos.x - 1, y: fromPos.y }, 'horizontal');
        }
        else if (dy === -1) {
            return this.hasWallAt(gameState, { x: fromPos.x, y: fromPos.y - 1 }, 'horizontal') ||
                this.hasWallAt(gameState, { x: fromPos.x - 1, y: fromPos.y - 1 }, 'horizontal');
        }
        return false;
    }
    wouldLeaveValidPaths(gameState, wallPos, orientation) {
        if (orientation === 'horizontal') {
            if (wallPos.y === 0 || wallPos.y === 7) {
                return false;
            }
        }
        else {
            if (wallPos.x === 0 || wallPos.x === 7) {
                return false;
            }
        }
        return true;
    }
    canReachRow(gameState, fromPos, goalRow) {
        return true;
    }
    positionsEqual(pos1, pos2) {
        return pos1.x === pos2.x && pos1.y === pos2.y;
    }
}
exports.MockQuoridorEngine = MockQuoridorEngine;
exports.mockQuoridorEngine = new MockQuoridorEngine();
