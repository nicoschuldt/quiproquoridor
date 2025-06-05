import { QuoridorEngine } from '../QuoridorEngine';
import type { GameState, Player, Position, WallOrientation, Move } from '../../shared/types';

function createTestMove(partialMove: Omit<Move, 'id' | 'timestamp'>): Move {
  return {
    ...partialMove,
    id: `test-move-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date(),
  };
}

describe('QuoridorEngine', () => {
  let engine: QuoridorEngine;
  let gameState: GameState;
  const player1Id = 'player1';
  const player2Id = 'player2';
  const player3Id = 'player3';
  const player4Id = 'player4';

  const createCustomGameState = (
    players: Array<{ id: string; position: Position }>,
    walls: Array<{ position: Position; orientation: WallOrientation }> = []
  ): GameState => {
    const maxPlayers = players.length <= 2 ? 2 : 4;
    const ids = players.map((p) => p.id);
    const state = engine.createGame(ids, maxPlayers);

    players.forEach((p) => {
      const gp = state.players.find((pl) => pl.id === p.id);
      if (gp) {
        gp.position = { ...p.position };
      }
    });

    walls.forEach((w) => {
      state.walls.push({
        id: `wall-${w.position.x}-${w.position.y}-${w.orientation}`,
        position: { ...w.position },
        orientation: w.orientation,
        playerId: player1Id,
      });
      const pl1 = state.players.find((pl) => pl.id === player1Id);
      if (pl1) pl1.wallsRemaining--;
    });

    const idx1 = state.players.findIndex((pl) => pl.id === player1Id);
    if (idx1 >= 0) {
      state.currentPlayerIndex = idx1;
    }
    return state;
  };

  beforeEach(() => {
    engine = new QuoridorEngine();
    gameState = engine.createGame([player1Id, player2Id], 2);
  });

  describe('Création du jeu', () => {
    it('devrait créer un état de jeu valide avec 2 joueurs', () => {
      expect(gameState.players).toHaveLength(2);
      expect(gameState.status).toBe('playing');
      expect(gameState.maxPlayers).toBe(2);
      expect(gameState.currentPlayerIndex).toBe(0);
    });

    it('devrait placer les joueurs aux positions de départ correctes pour une partie à 2', () => {
      const player1 = gameState.players[0];
      const player2 = gameState.players[1];

      expect(player1.position).toEqual({ x: 4, y: 8 });
      expect(player2.position).toEqual({ x: 4, y: 0 });
    });

    it('devrait donner le bon nombre de murs à chaque joueur (2 joueurs)', () => {
      expect(gameState.players[0].wallsRemaining).toBe(10);
      expect(gameState.players[1].wallsRemaining).toBe(10);
    });

    it('devrait donner 5 murs à chaque joueur dans une partie à 4', () => {
      const fourPlayerGame = engine.createGame(
        [player1Id, player2Id, player3Id, player4Id],
        4
      );
      fourPlayerGame.players.forEach((pl) => {
        expect(pl.wallsRemaining).toBe(5);
      });
    });
  });

  describe('Déplacements des pions', () => {
    it("devrait valider un déplacement de pion de base vers l'avant", () => {
      const move = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 4, y: 7 },
      });
      const isValid = engine.validateMove(gameState, move);
      expect(isValid).toBe(true);
    });

    it('ne devrait pas permettre de se déplacer sur une case occupée', () => {
      gameState.players[1].position = { x: 4, y: 7 };

      const move = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 4, y: 7 },
      });
      const isValid = engine.validateMove(gameState, move);
      expect(isValid).toBe(false);
    });

    it('devrait permettre de sauter par-dessus un adversaire', () => {
      const customState = createCustomGameState(
        [
          { id: player1Id, position: { x: 4, y: 8 } },
          { id: player2Id, position: { x: 4, y: 7 } },
        ]
      );
      const move = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 4, y: 6 },
      });
      expect(engine.validateMove(customState, move)).toBe(true);
    });

    it('devrait permettre un déplacement en diagonale quand un mur bloque le saut', () => {
      const customState = createCustomGameState(
        [
          { id: player1Id, position: { x: 0, y: 8 } },
          { id: player2Id, position: { x: 0, y: 7 } },
        ],
        [
          { position: { x: 0, y: 6 }, orientation: 'horizontal' },
        ]
      );

      const moveRight = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 0, y: 8 },
        toPosition: { x: 1, y: 7 },
      });
      expect(engine.validateMove(customState, moveRight)).toBe(true);
    });

    it('ne devrait pas permettre de traverser un mur', () => {
      const customState = createCustomGameState(
        [
          { id: player1Id, position: { x: 4, y: 8 } },
          { id: player2Id, position: { x: 4, y: 0 } },
        ],
        [
          { position: { x: 4, y: 7 }, orientation: 'horizontal' },
        ]
      );
      const move = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 4, y: 7 },
      });
      expect(engine.validateMove(customState, move)).toBe(false);
    });
  });

  describe('Placement des murs', () => {
    it('devrait placer un mur horizontal de 2 cases', () => {
      const wallMove = createTestMove({
        type: 'wall',
        playerId: player1Id,
        wallPosition: { x: 0, y: 1 },
        wallOrientation: 'horizontal',
      });
      const newState = engine.applyMove(gameState, wallMove);

      expect(newState.walls).toHaveLength(1);
      expect(newState.walls[0].position).toEqual({ x: 0, y: 1 });
      expect(newState.walls[0].orientation).toBe('horizontal');

      const p1 = newState.players.find((p: Player) => p.id === player1Id)!;
      expect(p1.wallsRemaining).toBe(9);
    });

    it('ne devrait pas permettre aux murs de se chevaucher', () => {
      const wall1 = createTestMove({
        type: 'wall',
        playerId: player1Id,
        wallPosition: { x: 0, y: 1 },
        wallOrientation: 'horizontal',
      });
      const state1 = engine.applyMove(gameState, wall1);

      const wall2 = createTestMove({
        type: 'wall',
        playerId: player2Id,
        wallPosition: { x: 1, y: 1 },
        wallOrientation: 'horizontal',
      });
      expect(engine.validateMove(state1, wall2)).toBe(false);
    });

    it('ne devrait pas permettre de placer des murs sur les bords du plateau', () => {
      const wallRight = createTestMove({
        type: 'wall',
        playerId: player1Id,
        wallPosition: { x: 8, y: 1 },
        wallOrientation: 'horizontal',
      });
      expect(engine.validateMove(gameState, wallRight)).toBe(false);

      const wallBottom = createTestMove({
        type: 'wall',
        playerId: player1Id,
        wallPosition: { x: 1, y: 8 },
        wallOrientation: 'vertical',
      });
      expect(engine.validateMove(gameState, wallBottom)).toBe(false);
    });

    it('ne devrait pas permettre de bloquer complètement un joueur', () => {
      const customState = createCustomGameState(
        [
          { id: player1Id, position: { x: 4, y: 1 } },
          { id: player2Id, position: { x: 4, y: 8 } },
        ],
        [
          { position: { x: 4, y: 0 }, orientation: 'horizontal' },
          { position: { x: 4, y: 1 }, orientation: 'horizontal' },
          { position: { x: 3, y: 1 }, orientation: 'vertical' },
          { position: { x: 4, y: 1 }, orientation: 'vertical' },
        ]
      );

      const blockingWall = createTestMove({
        type: 'wall',
        playerId: player2Id,
        wallPosition: { x: 4, y: 2 },
        wallOrientation: 'horizontal',
      });
      expect(engine.validateMove(customState, blockingWall)).toBe(false);
    });
  });

  describe('Condition de victoire', () => {
    it("devrait détecter quand un joueur atteint la ligne d'arrivée (2 joueurs)", () => {
      gameState.players[0].position = { x: 4, y: 0 };

      expect(engine.isGameFinished(gameState)).toBe(true);
      expect(engine.getWinner(gameState)).toBe(player1Id);
    });

    it("devrait détecter la victoire dans une partie à 4 joueurs", () => {
      const fourPlayerState = engine.createGame(
        [player1Id, player2Id, player3Id, player4Id],
        4
      );
      fourPlayerState.players[0].position = { x: 4, y: 0 };

      expect(engine.isGameFinished(fourPlayerState)).toBe(true);
      expect(engine.getWinner(fourPlayerState)).toBe(player1Id);
    });
  });

  describe('Cas spéciaux', () => {
    it('devrait gérer correctement les bords du plateau', () => {
      const customState = createCustomGameState([
        { id: player1Id, position: { x: 0, y: 8 } },
        { id: player2Id, position: { x: 4, y: 0 } },
      ]);

      const validMoves = engine.getValidMoves(customState, player1Id);
      expect(
        validMoves.some(
          (m) =>
            m.type === 'pawn' &&
            m.toPosition?.x === 0 &&
            m.toPosition?.y === 7
        )
      ).toBe(true);
      expect(
        validMoves.some(
          (m) =>
            m.type === 'pawn' &&
            m.toPosition?.x === 1 &&
            m.toPosition?.y === 8
        )
      ).toBe(true);

      expect(
        validMoves.some((m) => m.toPosition?.x === -1)
      ).toBe(false);
      expect(
        validMoves.some((m) => m.toPosition?.y === 9)
      ).toBe(false);
    });

    it('devrait gérer correctement les sauts de pions et les déplacements en diagonale', () => {
      const stateTwoPawns = createCustomGameState([
        { id: player1Id, position: { x: 4, y: 8 } },
        { id: player2Id, position: { x: 4, y: 7 } },
      ]);

      const jumpOverOne = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 4, y: 6 },
      });
      expect(engine.validateMove(stateTwoPawns, jumpOverOne)).toBe(true);

      const fourPlayerEng = new QuoridorEngine();
      const state4 = fourPlayerEng.createGame(
        [player1Id, player2Id, player3Id, player4Id],
        4
      );
      const p1_4 = state4.players.find((p) => p.id === player1Id)!;
      const p2_4 = state4.players.find((p) => p.id === player2Id)!;
      const p3_4 = state4.players.find((p) => p.id === player3Id)!;
      p1_4.position = { x: 4, y: 8 };
      p2_4.position = { x: 4, y: 7 };
      p3_4.position = { x: 4, y: 6 };

      const jumpOverTwo = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 4, y: 5 },
      });
      expect(fourPlayerEng.validateMove(state4, jumpOverTwo)).toBe(false);

      const stateWithWallBehind = createCustomGameState(
        [
          { id: player1Id, position: { x: 4, y: 8 } },
          { id: player2Id, position: { x: 4, y: 7 } },
        ],
        [
          { position: { x: 4, y: 6 }, orientation: 'horizontal' },
        ]
      );
      const diagonalR = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 5, y: 7 },
      });
      const diagonalL = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 3, y: 7 },
      });
      expect(engine.validateMove(stateWithWallBehind, diagonalR)).toBe(true);
      expect(engine.validateMove(stateWithWallBehind, diagonalL)).toBe(true);
    });
  });
});
