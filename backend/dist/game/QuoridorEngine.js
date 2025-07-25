"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoridorEngine = exports.QuoridorEngine = void 0;
// backend/src/game/QuoridorEngine.ts
const uuid_1 = require("uuid");
const types_1 = require("../shared/types");
/**
 * QuoridorEngine - Moteur de jeu corrigé pour prendre en compte que chaque barrière
 * occupe 2 cases de longueur :
 *   - Un mur "horizontal" enregistré en (x,y) bloque la jonction
 *     entre case (x,y)↔(x,y+1) et entre case (x+1,y)↔(x+1,y+1).
 *   - Un mur "vertical"   enregistré en (x,y) bloque la jonction
 *     entre case (x,y)↔(x+1,y) et entre case (x,y+1)↔(x+1,y+1).
 */
class QuoridorEngine {
    constructor() {
        this.pathCache = new Map();
    }
    // ================================
    // IMPLEMENTATION DE L'INTERFACE GameEngine
    // ================================
    createGame(playerIds, maxPlayers) {
        if (playerIds.length < 2 || playerIds.length > 4) {
            throw new Error('Le nombre de joueurs doit être compris entre 2 et 4');
        }
        if (playerIds.length !== maxPlayers) {
            throw new Error(`Le nombre de joueurs (${playerIds.length}) ne correspond pas à ${maxPlayers}`);
        }
        const colors = ['red', 'blue', 'green', 'yellow'];
        const maxWalls = maxPlayers === 2 ? types_1.MAX_WALLS_2P : types_1.MAX_WALLS_4P;
        const players = playerIds.map((id, index) => ({
            id,
            username: `Joueur ${index + 1}`,
            color: colors[index],
            position: this.getPlayerStartPosition(index, maxPlayers),
            wallsRemaining: maxWalls,
            isConnected: true,
            joinedAt: new Date(),
            selectedPawnTheme: 'theme-pawn-default',
            isAI: false,
            aiDifficulty: undefined,
        }));
        const gameState = {
            id: (0, uuid_1.v4)(),
            players,
            walls: [],
            currentPlayerIndex: 0,
            status: 'waiting',
            moves: [],
            maxPlayers,
            createdAt: new Date(),
        };
        gameState.status = 'playing';
        gameState.startedAt = new Date();
        return gameState;
    }
    validateMove(gameState, move) {
        if (gameState.status !== 'playing') {
            return false;
        }
        const currentPlayer = this.getCurrentPlayer(gameState);
        if (move.playerId !== currentPlayer.id) {
            return false;
        }
        if (move.type === 'pawn') {
            if (!move.fromPosition ||
                !this.arePositionsEqual(currentPlayer.position, move.fromPosition)) {
                return false;
            }
            return this.isValidPawnMove(gameState, move.fromPosition, move.toPosition, move.playerId);
        }
        else if (move.type === 'wall') {
            return this.isValidWallPlacement(gameState, move.wallPosition, move.wallOrientation);
        }
        return false;
    }
    applyMove(gameState, move) {
        const newState = JSON.parse(JSON.stringify(gameState));
        const fullMove = {
            id: (0, uuid_1.v4)(),
            ...move,
            timestamp: new Date(),
        };
        if (move.type === 'pawn') {
            const player = newState.players.find((p) => p.id === move.playerId);
            if (player) {
                player.position = { ...move.toPosition };
            }
        }
        else if (move.type === 'wall') {
            const player = newState.players.find((p) => p.id === move.playerId);
            if (player && player.wallsRemaining > 0) {
                newState.walls.push({
                    id: (0, uuid_1.v4)(),
                    position: { ...move.wallPosition },
                    orientation: move.wallOrientation,
                    playerId: move.playerId,
                });
                player.wallsRemaining--;
            }
            else {
                throw new Error("Le joueur n'a plus de murs disponibles");
            }
        }
        newState.moves.push(fullMove);
        newState.currentPlayerIndex =
            (newState.currentPlayerIndex + 1) % newState.players.length;
        if (this.isGameFinished(newState)) {
            newState.status = 'finished';
            newState.finishedAt = new Date();
            const winnerId = this.getWinner(newState);
            if (winnerId) {
                newState.winner = winnerId;
            }
        }
        return newState;
    }
    isGameFinished(gameState) {
        return gameState.players.some((player, idx) => this.isAtGoal(player.position, idx, gameState.maxPlayers));
    }
    getWinner(gameState) {
        const winner = gameState.players.find((player, idx) => this.isAtGoal(player.position, idx, gameState.maxPlayers));
        return winner ? winner.id : null;
    }
    getCurrentPlayer(gameState) {
        return gameState.players[gameState.currentPlayerIndex];
    }
    getValidMoves(gameState, playerId) {
        const moves = [];
        const player = this.getPlayerById(gameState, playerId);
        if (!player || this.getCurrentPlayer(gameState).id !== playerId) {
            return [];
        }
        // 1) Déplacements de pion
        const validPawnPositions = this.getValidPawnMoves(gameState, player);
        for (const toPos of validPawnPositions) {
            moves.push({
                type: 'pawn',
                playerId,
                fromPosition: { ...player.position },
                toPosition: toPos,
            });
        }
        // 2) Placements de murs
        if (player.wallsRemaining > 0) {
            for (let x = 0; x < types_1.BOARD_SIZE - 1; x++) {
                for (let y = 0; y < types_1.BOARD_SIZE - 1; y++) {
                    const pos = { x, y };
                    if (this.isValidWallPlacement(gameState, pos, 'horizontal')) {
                        moves.push({
                            type: 'wall',
                            playerId,
                            wallPosition: { ...pos },
                            wallOrientation: 'horizontal',
                        });
                    }
                    if (this.isValidWallPlacement(gameState, pos, 'vertical')) {
                        moves.push({
                            type: 'wall',
                            playerId,
                            wallPosition: { ...pos },
                            wallOrientation: 'vertical',
                        });
                    }
                }
            }
        }
        return moves;
    }
    isValidPawnMove(gameState, fromPos, toPos, playerId) {
        if (!this.isPositionValid(fromPos) || !this.isPositionValid(toPos)) {
            return false;
        }
        const player = this.getPlayerById(gameState, playerId);
        if (!player || !this.arePositionsEqual(player.position, fromPos)) {
            return false;
        }
        const valid = this.getValidPawnMoves(gameState, player);
        return valid.some((pos) => this.arePositionsEqual(pos, toPos));
    }
    isValidWallPlacement(gameState, wallPos, orientation) {
        // 1) Vérification des limites (chaque barrière occupe 2 cases)
        if (!this.isWallPositionValid(wallPos, orientation)) {
            return false;
        }
        // 2) Empêchement des chevauchements / extensions interdites
        for (const existing of gameState.walls) {
            // même orientation et même coordonnée → chevauchement direct
            if (existing.position.x === wallPos.x &&
                existing.position.y === wallPos.y &&
                existing.orientation === orientation) {
                return false;
            }
            // deux murs horizontaux bout à bout interdits :
            // si orientation="horizontal", on interdit un deuxième mur en (x±1, y)
            if (orientation === 'horizontal' &&
                existing.orientation === 'horizontal' &&
                existing.position.y === wallPos.y &&
                Math.abs(existing.position.x - wallPos.x) === 1) {
                return false;
            }
            // deux murs verticaux bout à bout interdits :
            // si orientation="vertical", on interdit un deuxième mur en (x, y±1)
            if (orientation === 'vertical' &&
                existing.orientation === 'vertical' &&
                existing.position.x === wallPos.x &&
                Math.abs(existing.position.y - wallPos.y) === 1) {
                return false;
            }
        }
        // 3) FIXED: Empêchement des croisements horizontal/vertical (X-crossings only)
        // Only prevent walls that occupy the exact same position with different orientations
        // Allow T-shapes where walls meet at corners
        if (orientation === 'horizontal') {
            // Un mur horizontal en (x,y) croise un mur vertical seulement s'il existe 
            // un mur vertical à la position exacte (x,y) - cela crée un X
            const wx = wallPos.x;
            const wy = wallPos.y;
            if (gameState.walls.some((w) => w.orientation === 'vertical' &&
                w.position.x === wx &&
                w.position.y === wy)) {
                return false;
            }
        }
        else {
            // orientation="vertical"
            // Un mur vertical en (x,y) croise un mur horizontal seulement s'il existe
            // un mur horizontal à la position exacte (x,y) - cela crée un X
            const wx = wallPos.x;
            const wy = wallPos.y;
            if (gameState.walls.some((w) => w.orientation === 'horizontal' &&
                w.position.x === wx &&
                w.position.y === wy)) {
                return false;
            }
        }
        // 4) Vérifier que le joueur courant a encore des murs
        const currentPlayer = this.getCurrentPlayer(gameState);
        if (currentPlayer.wallsRemaining <= 0) {
            return false;
        }
        // 5) Empêchement de bloquer totalement un chemin
        const tempWalls = [
            ...gameState.walls,
            {
                id: 'temp',
                position: { ...wallPos },
                orientation,
                playerId: currentPlayer.id,
            },
        ];
        for (let i = 0; i < gameState.players.length; i++) {
            const p = gameState.players[i];
            if (!this.hasPathToGoalWithWalls(p, gameState.players, tempWalls, gameState.maxPlayers)) {
                return false;
            }
        }
        return true;
    }
    hasValidPathToGoal(gameState, playerId) {
        const player = this.getPlayerById(gameState, playerId);
        if (!player)
            return false;
        return this.hasPathToGoalWithWalls(player, gameState.players, gameState.walls, gameState.maxPlayers);
    }
    getPlayerById(gameState, playerId) {
        return gameState.players.find((p) => p.id === playerId) || null;
    }
    getPlayerStartPosition(playerIndex, maxPlayers) {
        const mid = Math.floor(types_1.BOARD_SIZE / 2);
        if (maxPlayers === 2) {
            // Joueur 0 = bas-centre (y = BOARD_SIZE-1), Joueur 1 = haut-centre (y = 0)
            return playerIndex === 0
                ? { x: mid, y: types_1.BOARD_SIZE - 1 }
                : { x: mid, y: 0 };
        }
        else {
            // 4 joueurs : 0=bas, 1=droite, 2=haut, 3=gauche
            switch (playerIndex) {
                case 0:
                    return { x: mid, y: types_1.BOARD_SIZE - 1 };
                case 1:
                    return { x: types_1.BOARD_SIZE - 1, y: mid };
                case 2:
                    return { x: mid, y: 0 };
                case 3:
                    return { x: 0, y: mid };
                default:
                    throw new Error(`Index de joueur invalide: ${playerIndex}`);
            }
        }
    }
    getPlayerGoalRow(playerIndex, maxPlayers) {
        if (maxPlayers === 2) {
            // 2 joueurs : index 0 → but y = 0, index 1 → but y = BOARD_SIZE - 1
            return playerIndex === 0 ? 0 : types_1.BOARD_SIZE - 1;
        }
        else {
            // 4 joueurs :
            //   0 (bas)    → but y = 0
            //   1 (droite) → but x = 0
            //   2 (haut)   → but y = BOARD_SIZE - 1
            //   3 (gauche) → but x = BOARD_SIZE - 1
            switch (playerIndex) {
                case 0:
                    return 0; // y = 0
                case 1:
                    return 0; // x = 0
                case 2:
                    return types_1.BOARD_SIZE - 1; // y = 8
                case 3:
                    return types_1.BOARD_SIZE - 1; // x = 8
                default:
                    throw new Error(`Index de joueur invalide: ${playerIndex}`);
            }
        }
    }
    // ================================
    // METHODES PRIVEES D'AIDE
    // ================================
    isPositionValid(pos) {
        return (pos.x >= 0 && pos.x < types_1.BOARD_SIZE && pos.y >= 0 && pos.y < types_1.BOARD_SIZE);
    }
    arePositionsEqual(pos1, pos2) {
        return pos1.x === pos2.x && pos1.y === pos2.y;
    }
    /**
     * Retourne toutes les positions atteignables pour un pion depuis `player.position`,
     * en tenant compte :
     *  - des autres pions (pour les sauts),
     *  - des murs (barrières) enregistrés, qui bloquent "entre" deux cases adjacentes.
     */
    getValidPawnMoves(gameState, player) {
        const from = player.position;
        const otherPlayers = gameState.players.filter((p) => p.id !== player.id);
        const destinations = [];
        // Directions orthogonales : haut, droite, bas, gauche
        const directions = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
        ];
        for (const dir of directions) {
            const adj = { x: from.x + dir.dx, y: from.y + dir.dy };
            if (!this.isPositionValid(adj))
                continue;
            // Si un mur bloque la jonction from↔adj → on ne peut pas aller là
            if (this.isWallBlocking(gameState.walls, from, adj))
                continue;
            // Vérifier s'il y a un pion adjacent
            const blockingPawn = otherPlayers.find((p) => p.position.x === adj.x && p.position.y === adj.y);
            if (!blockingPawn) {
                // Case libre, déplacement simple
                destinations.push(adj);
            }
            else {
                // Essayons de sauter par-dessus
                const jump = { x: adj.x + dir.dx, y: adj.y + dir.dy };
                if (this.isPositionValid(jump) &&
                    !this.isWallBlocking(gameState.walls, adj, jump) &&
                    !gameState.players.some((p) => p.position.x === jump.x && p.position.y === jump.y)) {
                    destinations.push(jump);
                }
                else {
                    // Sinon, essais des déplacements diagonaux
                    const sideDirs = dir.dx === 0
                        ? [
                            { dx: -1, dy: 0 }, // diagonale gauche
                            { dx: 1, dy: 0 }, // diagonale droite
                        ]
                        : [
                            { dx: 0, dy: -1 }, // diagonale haut
                            { dx: 0, dy: 1 }, // diagonale bas
                        ];
                    for (const side of sideDirs) {
                        const sidePos = {
                            x: adj.x + side.dx,
                            y: adj.y + side.dy,
                        };
                        if (!this.isPositionValid(sidePos))
                            continue;
                        if (this.isWallBlocking(gameState.walls, adj, sidePos) ||
                            gameState.players.some((p) => p.position.x === sidePos.x &&
                                p.position.y === sidePos.y)) {
                            continue;
                        }
                        destinations.push(sidePos);
                    }
                }
            }
        }
        // Retirer les doublons
        const unique = [];
        for (const pos of destinations) {
            if (!unique.some((u) => this.arePositionsEqual(u, pos))) {
                unique.push(pos);
            }
        }
        return unique;
    }
    /**
     * Vérifie si un mur bloque la transition "entre deux cases adjacentes" from→to.
     *
     * - Mouvement vertical (dy = ±1) :
     *   • Si on descend (to.y = from.y + 1), on bloque si
     *     existe un mur horizontal enregistré en (bx, by) tel que :
     *       by === from.y  &&  (from.x === bx  ||  from.x === bx + 1)
     *   • Si on monte   (to.y = from.y - 1), on bloque si
     *     existe un mur horizontal enregistré en (bx, by) tel que :
     *       by === to.y    &&  (from.x === bx  ||  from.x === bx + 1)
     *
     * - Mouvement horizontal (dx = ±1) :
     *   • Si on va vers la droite (to.x = from.x + 1), on bloque si
     *     existe un mur vertical enregistré en (bx, by) tel que :
     *       bx === from.x  &&  (from.y === by  ||  from.y === by + 1)
     *   • Si on va vers la gauche  (to.x = from.x - 1), on bloque si
     *     existe un mur vertical enregistré en (bx, by) tel que :
     *       bx === to.x    &&  (from.y === by  ||  from.y === by + 1)
     */
    isWallBlocking(walls, from, to) {
        // 1) Mouvement vertical (même x, |dy| = 1)
        if (from.x === to.x && Math.abs(from.y - to.y) === 1) {
            // Descendre (dy = +1)
            if (to.y > from.y) {
                // Un mur horizontal en (bx, by = from.y) bloque à x = bx et x = bx + 1
                return walls.some((w) => w.orientation === 'horizontal' &&
                    w.position.y === from.y &&
                    (from.x === w.position.x || from.x === w.position.x + 1));
            }
            else {
                // Monter (dy = -1), to.y = from.y - 1
                return walls.some((w) => w.orientation === 'horizontal' &&
                    w.position.y === to.y &&
                    (from.x === w.position.x || from.x === w.position.x + 1));
            }
        }
        // 2) Mouvement horizontal (même y, |dx| = 1)
        if (from.y === to.y && Math.abs(from.x - to.x) === 1) {
            // Aller vers la droite (dx = +1)
            if (to.x > from.x) {
                // Un mur vertical en (bx = from.x, by) bloque à y = by et y = by + 1
                return walls.some((w) => w.orientation === 'vertical' &&
                    w.position.x === from.x &&
                    (from.y === w.position.y || from.y === w.position.y + 1));
            }
            else {
                // Aller vers la gauche (dx = -1), to.x = from.x - 1
                return walls.some((w) => w.orientation === 'vertical' &&
                    w.position.x === to.x &&
                    (from.y === w.position.y || from.y === w.position.y + 1));
            }
        }
        // Sinon, ce n'est pas un déplacement entre deux cases adjacentes orthogonales
        return false;
    }
    /**
     * BFS pour vérifier qu'un joueur peut atteindre son objectif,
     * en tenant compte de la liste complète des murs (tempWalls) passés en argument.
     */
    hasPathToGoalWithWalls(player, allPlayers, walls, maxPlayers) {
        const start = player.position;
        const visited = new Set();
        const queue = [start];
        const playerIndex = allPlayers.findIndex((p) => p.id === player.id);
        if (playerIndex < 0)
            return false;
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.x},${current.y}`;
            if (visited.has(key))
                continue;
            visited.add(key);
            // If we've reached the goal, we found a path
            if (this.isAtGoal(current, playerIndex, maxPlayers)) {
                return true;
            }
            const deltas = [
                { dx: 0, dy: -1 },
                { dx: 1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: 0 },
            ];
            for (const delta of deltas) {
                const next = {
                    x: current.x + delta.dx,
                    y: current.y + delta.dy,
                };
                if (!this.isPositionValid(next))
                    continue;
                if (this.isWallBlocking(walls, current, next))
                    continue;
                queue.push(next);
            }
        }
        return false;
    }
    isWallPositionValid(pos, orientation) {
        // Chaque barrière occupe exactement 2 cases, donc pos.x,pos.y ∈ [0..BOARD_SIZE-2]
        if (orientation === 'horizontal') {
            // Un mur horizontal en (x,y) bloque la jonction (x,y)↔(x,y+1) et (x+1,y)↔(x+1,y+1)
            return pos.x >= 0 && pos.x < types_1.BOARD_SIZE - 1 && pos.y >= 0 && pos.y < types_1.BOARD_SIZE - 1;
        }
        else {
            // Un mur vertical en (x,y) bloque la jonction (x,y)↔(x+1,y) et (x,y+1)↔(x+1,y+1)
            return pos.x >= 0 && pos.x < types_1.BOARD_SIZE - 1 && pos.y >= 0 && pos.y < types_1.BOARD_SIZE - 1;
        }
    }
    isAtGoal(pos, playerIndex, maxPlayers) {
        if (maxPlayers === 2) {
            return playerIndex === 0
                ? pos.y === 0
                : pos.y === types_1.BOARD_SIZE - 1;
        }
        else {
            switch (playerIndex) {
                case 0:
                    return pos.y === 0;
                case 1:
                    return pos.x === 0;
                case 2:
                    return pos.y === types_1.BOARD_SIZE - 1;
                case 3:
                    return pos.x === types_1.BOARD_SIZE - 1;
                default:
                    return false;
            }
        }
    }
}
exports.QuoridorEngine = QuoridorEngine;
exports.quoridorEngine = new QuoridorEngine();
