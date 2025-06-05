"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChampionAI = void 0;
exports.createChampionAI = createChampionAI;
const types_1 = require("../shared/types");
const QuoridorEngine_1 = require("../game/QuoridorEngine");
const MAX = 1e9;
const RIVAL_GAIN = 2; // rule 2 (+2 steps for rival)
const SELF_PENALTY = 1; // rule 2 (≤ +1 for us)
const SPRINT_DISTANCE = 3; // rule 5
class ChampionAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
    }
    getName() { return `ChampionAI (${this.difficulty})`; }
    getDifficulty() { return this.difficulty; }
    async generateMove(gs, id) {
        const me = gs.players.find(p => p.id === id);
        const opp = gs.players.find(p => p.id !== id); // 2-player only
        const meIx = gs.players.indexOf(me);
        const opIx = gs.players.indexOf(opp);
        const myGoal = QuoridorEngine_1.quoridorEngine.getPlayerGoalRow(meIx, gs.maxPlayers);
        const opGoal = QuoridorEngine_1.quoridorEngine.getPlayerGoalRow(opIx, gs.maxPlayers);
        const myPath = this.pathLen(gs, me.position, myGoal, me.id, meIx);
        const opPath = this.pathLen(gs, opp.position, opGoal, opp.id, opIx);
        /* ---------- WALL PHASE ---------- */
        if (me.wallsRemaining > 0
            && myPath - opPath >= -1 // we’re not clearly behind
            && Math.min(myPath, opPath) > SPRINT_DISTANCE) {
            const best = this.chooseWall(gs, me, opp, opGoal, myGoal, opPath, myPath);
            if (best)
                return best;
        }
        /* ---------- RUN PHASE ---------- */
        return this.advancePawn(gs, me, myGoal, myPath);
    }
    /* ===== utilities ===== */
    pathLen(gs, pos, goalY, pid, pIx) {
        // BFS with only orthogonal single-step moves
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        const Q = [[pos, 0]];
        const seen = new Set([`${pos.x},${pos.y}`]);
        while (Q.length) {
            const [p, d] = Q.shift();
            // goal for side players (4-p) is column; engine reuses ‘goal row’ API
            if ((gs.maxPlayers === 2 && p.y === goalY) ||
                (gs.maxPlayers === 4 && ((pIx === 1 && p.x === 0) || (pIx === 3 && p.x === types_1.BOARD_SIZE - 1) ||
                    (pIx === 0 && p.y === 0) || (pIx === 2 && p.y === types_1.BOARD_SIZE - 1))))
                return d;
            for (const [dx, dy] of dirs) {
                const n = { x: p.x + dx, y: p.y + dy };
                const key = `${n.x},${n.y}`;
                if (!seen.has(key)
                    && (0, types_1.isPosition)(n)
                    && QuoridorEngine_1.quoridorEngine.isValidPawnMove(gs, p, n, pid)) {
                    seen.add(key);
                    Q.push([n, d + 1]);
                }
            }
        }
        return MAX; // should never happen with legal boards
    }
    chooseWall(gs, me, opp, opGoal, myGoal, opPath, myPath) {
        const moves = QuoridorEngine_1.quoridorEngine.getValidMoves(gs, me.id)
            .filter(m => m.type === 'wall');
        let bestMove = null;
        let bestGain = -Infinity;
        for (const m of moves) {
            const sim = JSON.parse(JSON.stringify(gs));
            sim.walls.push({
                id: 'sim', playerId: me.id, position: m.wallPosition,
                orientation: m.wallOrientation
            });
            const opNew = this.pathLen(sim, opp.position, opGoal, opp.id, gs.players.indexOf(opp));
            const meNew = this.pathLen(sim, me.position, myGoal, me.id, gs.players.indexOf(me));
            const oppΔ = opNew - opPath;
            const meΔ = meNew - myPath;
            const gain = oppΔ - meΔ;
            if (oppΔ >= RIVAL_GAIN && meΔ <= SELF_PENALTY && gain > bestGain
                && QuoridorEngine_1.quoridorEngine.hasValidPathToGoal(sim, me.id)
                && QuoridorEngine_1.quoridorEngine.hasValidPathToGoal(sim, opp.id)) {
                bestGain = gain;
                bestMove = m;
            }
        }
        return bestMove;
    }
    advancePawn(gs, me, myGoal, current) {
        const moves = QuoridorEngine_1.quoridorEngine.getValidMoves(gs, me.id)
            .filter(m => m.type === 'pawn' && m.toPosition);
        // rank by remaining distance then ‘centrality’ (stay near column 4)
        moves.sort((a, b) => {
            const dA = this.pathLen(gs, a.toPosition, myGoal, me.id, gs.players.indexOf(me));
            const dB = this.pathLen(gs, b.toPosition, myGoal, me.id, gs.players.indexOf(me));
            if (dA !== dB)
                return dA - dB;
            return Math.abs(a.toPosition.x - 4) - Math.abs(b.toPosition.x - 4);
        });
        // first move that strictly decreases our path
        const best = moves.find(m => this.pathLen(gs, m.toPosition, myGoal, me.id, gs.players.indexOf(me)) < current);
        return best ?? moves[0];
    }
}
exports.ChampionAI = ChampionAI;
function createChampionAI(difficulty) {
    return new ChampionAI(difficulty);
}
