"use strict";
// src/ai/ChampionshipMCTS.ts
// Drop-in replacement for `MonteCarloAI` – identical public interface
// Uses a lighter, faster MCTS with progressive bias and early roll-out cut-offs.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChampionshipMCTS = void 0;
exports.createChampionshipAI = createChampionshipAI;
const GameEngineManager_1 = require("../game/GameEngineManager");
class Pathfinder {
    static shortest(state, playerId) {
        const me = state.players.find(p => p.id === playerId);
        const start = me.position;
        const q = [[start, 0, null]];
        const seen = new Set();
        const encode = (p) => `${p.x},${p.y}`;
        const playerIndex = state.players.findIndex(p => p.id === playerId);
        const isGoal = (p) => GameEngineManager_1.gameEngineManager.getPlayerGoalRow(playerIndex, state.maxPlayers) === p.y;
        while (q.length) {
            const [pos, dist, first] = q.shift();
            const key = encode(pos);
            if (seen.has(key))
                continue;
            seen.add(key);
            if (isGoal(pos))
                return { distance: dist, next: first ?? pos };
            for (const m of GameEngineManager_1.gameEngineManager.getValidMoves(state, playerId)) {
                if (m.type !== 'pawn')
                    continue;
                const next = m.toPosition;
                q.push([next, dist + 1, first ?? next]);
            }
        }
        return { distance: Infinity, next: null };
    }
}
// ————————————————————————————————————————————————————————————————
//  LIGHT MCTS  –  progressive bias, early roll-out stop
// ————————————————————————————————————————————————————————————————
class Node {
    constructor(state, move, parent, playerId) {
        this.children = [];
        this.visits = 0;
        this.valueSum = 0;
        this.state = state;
        this.move = move;
        this.parent = parent;
        this.playerId = playerId;
        this.untried = GameEngineManager_1.gameEngineManager.getValidMoves(state, GameEngineManager_1.gameEngineManager.getCurrentPlayer(state).id);
    }
    uct(explore) {
        if (!this.parent)
            return 0;
        if (this.visits === 0)
            return Infinity;
        const exploit = this.valueSum / this.visits;
        const exploreTerm = explore * Math.sqrt(Math.log(this.parent.visits) / this.visits);
        const bias = this.move ? Heuristics.delta(this.parent.state, this.move, this.playerId) * 0.3 : 0;
        return exploit + exploreTerm + bias;
    }
    selectChild(explore) {
        return this.children.reduce((best, c) => (c.uct(explore) > best.uct(explore) ? c : best));
    }
    expand() {
        const mv = this.untried.splice(Math.floor(Math.random() * this.untried.length), 1)[0];
        const nextState = GameEngineManager_1.gameEngineManager.applyMove(this.state, mv);
        const child = new Node(nextState, mv, this, this.playerId);
        this.children.push(child);
        return child;
    }
    update(value) {
        this.visits += 1;
        this.valueSum += value;
    }
    getBestChild() {
        return this.children.reduce((a, b) => (b.visits > a.visits ? b : a));
    }
}
// ————————————————————————————————————————————————————————————————
//  SIMPLE HEURISTICS  –  Δ = dOpp − dMe in [-1,1]
// ————————————————————————————————————————————————————————————————
class Heuristics {
    static delta(state, move, playerId) {
        const s2 = GameEngineManager_1.gameEngineManager.applyMove(state, move);
        const myD = Pathfinder.shortest(s2, playerId).distance;
        const oppD = Math.min(...s2.players
            .filter(p => p.id !== playerId)
            .map(p => Pathfinder.shortest(s2, p.id).distance));
        if (myD === Infinity)
            return -1;
        if (oppD === Infinity)
            return 1;
        return (oppD - myD) / 18; // board longest path ≤ 18
    }
    static evalRace(state, playerId) {
        const myD = Pathfinder.shortest(state, playerId).distance;
        const oppD = Math.min(...state.players
            .filter(p => p.id !== playerId)
            .map(p => Pathfinder.shortest(state, p.id).distance));
        if (myD === Infinity)
            return 0;
        if (oppD === Infinity)
            return 1;
        const adv = oppD - myD;
        return 1 / (1 + Math.exp(-adv / 2)); // sigmoid
    }
}
// ————————————————————————————————————————————————————————————————
//  MAIN AI  –  public interface identical to original
// ————————————————————————————————————————————————————————————————
class ChampionshipMCTS {
    constructor(difficulty = 'hard') {
        this.difficulty = difficulty;
        const table = {
            easy: [300, 1.5],
            medium: [800, 1.3],
            hard: [1600, 1.1],
        };
        [this.sims, this.c] = table[difficulty];
    }
    async generateMove(state, playerId) {
        const root = new Node(state, null, null, playerId);
        // trivial case – no walls left: deterministic shortest-path move
        if (state.players.find(p => p.id === playerId).wallsRemaining === 0) {
            const { next } = Pathfinder.shortest(state, playerId);
            return {
                type: 'pawn',
                playerId,
                fromPosition: state.players.find(p => p.id === playerId).position,
                toPosition: next,
            };
        }
        for (let i = 0; i < this.sims; ++i) {
            let node = root;
            // SELECTION
            while (node.untried.length === 0 && node.children.length)
                node = node.selectChild(this.c);
            // EXPANSION
            if (node.untried.length)
                node = node.expand();
            // SIMULATION / ROLL-OUT
            let rolloutState = node.state;
            let depth = 0;
            while (!GameEngineManager_1.gameEngineManager.isGameFinished(rolloutState) && depth < 30) {
                const current = GameEngineManager_1.gameEngineManager.getCurrentPlayer(rolloutState).id;
                const moves = GameEngineManager_1.gameEngineManager.getValidMoves(rolloutState, current);
                // ε-greedy: 80 % pick best Δ move, 20 % random
                const scored = moves.map(m => [m, Heuristics.delta(rolloutState, m, playerId)]);
                const chosen = Math.random() < 0.8
                    ? scored.sort((a, b) => b[1] - a[1])[0][0]
                    : moves[Math.floor(Math.random() * moves.length)];
                rolloutState = GameEngineManager_1.gameEngineManager.applyMove(rolloutState, chosen);
                depth += 1;
                // early termination if race clearly decided
                if (Math.abs(Heuristics.delta(rolloutState, chosen, playerId)) > 0.6)
                    break;
            }
            const reward = GameEngineManager_1.gameEngineManager.isGameFinished(rolloutState)
                ? (GameEngineManager_1.gameEngineManager.getWinner(rolloutState) === playerId ? 1 : 0)
                : Heuristics.evalRace(rolloutState, playerId);
            // BACK-PROPAGATION
            while (node) {
                node.update(reward);
                node = node.parent;
            }
        }
        return root.getBestChild().move;
    }
    getName() { return `Championship MCTS (${this.difficulty})`; }
    getDifficulty() { return this.difficulty; }
}
exports.ChampionshipMCTS = ChampionshipMCTS;
function createChampionshipAI(level) {
    return new ChampionshipMCTS(level);
}
