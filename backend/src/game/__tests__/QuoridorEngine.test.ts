// backend/src/game/QuoridorEngine.test.ts
import { QuoridorEngine } from '../QuoridorEngine';
import type { GameState, Player, Position, WallOrientation, Move } from '../../shared/types';

// Fonction utilitaire pour créer un mouvement valide pour les tests
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

  /**
   * Crée un état de jeu personnalisé :
   * - override des positions des joueurs
   * - ajout manuel de murs (avec décrémentation de wallsRemaining pour player1)
   * - forçage du tour à player1
   */
  const createCustomGameState = (
    players: Array<{ id: string; position: Position }>,
    walls: Array<{ position: Position; orientation: WallOrientation }> = []
  ): GameState => {
    // On déduit maxPlayers = 2 si seulement 2 ids, sinon 4
    const maxPlayers = players.length <= 2 ? 2 : 4;
    const ids = players.map((p) => p.id);
    const state = engine.createGame(ids, maxPlayers);

    // Override des positions
    players.forEach((p) => {
      const gp = state.players.find((pl) => pl.id === p.id);
      if (gp) {
        gp.position = { ...p.position };
      }
    });

    // Ajout manuel des murs
    walls.forEach((w) => {
      state.walls.push({
        id: `wall-${w.position.x}-${w.position.y}-${w.orientation}`,
        position: { ...w.position },
        orientation: w.orientation,
        playerId: player1Id, // On décrémente toujours wallsRemaining pour player1
      });
      const pl1 = state.players.find((pl) => pl.id === player1Id);
      if (pl1) pl1.wallsRemaining--;
    });

    // Forcer le tour à player1
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

  // ==========================================
  // Tests de base
  // ==========================================
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

      // Dans notre implémentation : player1 (index 0) démarre en bas-centre (y = 8)
      expect(player1.position).toEqual({ x: 4, y: 8 });
      // player2 (index 1) démarre en haut-centre (y = 0)
      expect(player2.position).toEqual({ x: 4, y: 0 });
    });

    it('devrait donner le bon nombre de murs à chaque joueur (2 joueurs)', () => {
      // MAX_WALLS_2P = 10
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

  // ==========================================
  // Tests de déplacement des pions
  // ==========================================
  describe('Déplacements des pions', () => {
    it("devrait valider un déplacement de pion de base vers l'avant", () => {
      // player1 démarre en (4,8). Aller vers "avant" = monter vers y = 7
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
      // Placer player2 directement devant player1 sur la ligne y = 7
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
      // Custom : player1 (4,8), player2 (4,7)
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
        toPosition: { x: 4, y: 6 }, // saut par-dessus (4,7)
      });
      expect(engine.validateMove(customState, move)).toBe(true);
    });

    it('devrait permettre un déplacement en diagonale quand un mur bloque le saut', () => {
      // player1 en (0,8), player2 en (0,7), mur horizontal en (0,6) bloque saut (0,8)->(0,7)->(0,6)
      const customState = createCustomGameState(
        [
          { id: player1Id, position: { x: 0, y: 8 } },
          { id: player2Id, position: { x: 0, y: 7 } },
        ],
        [
          // Pour bloquer la jonction (0,7)<->(0,6), on place le mur horizontal en (0,6)
          { position: { x: 0, y: 6 }, orientation: 'horizontal' },
        ]
      );

      // Diagonale à droite (1,7)
      const moveRight = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 0, y: 8 },
        toPosition: { x: 1, y: 7 },
      });
      expect(engine.validateMove(customState, moveRight)).toBe(true);

      // Diagonale à gauche (pas possible ici, x=-1 hors plateau) → on ne teste que la diagonale droite
    });

    it('ne devrait pas permettre de traverser un mur', () => {
      // player1 (4,8), player2 (4,0), mur horizontal en (4,7) bloque (4,7)<->(4,8)
      const customState = createCustomGameState(
        [
          { id: player1Id, position: { x: 4, y: 8 } },
          { id: player2Id, position: { x: 4, y: 0 } },
        ],
        [
          // Pour bloquer la jonction (4,8)<->(4,7), on place le mur horizontal en (4,7)
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

  // ==========================================
  // Tests de placement des murs
  // ==========================================
  describe('Placement des murs', () => {
    it('devrait placer un mur horizontal de 2 cases', () => {
      const wallMove = createTestMove({
        type: 'wall',
        playerId: player1Id,
        wallPosition: { x: 0, y: 1 },       // position valide pour horizontal
        wallOrientation: 'horizontal',
      });
      const newState = engine.applyMove(gameState, wallMove);

      // Vérifier ajout du mur
      expect(newState.walls).toHaveLength(1);
      expect(newState.walls[0].position).toEqual({ x: 0, y: 1 });
      expect(newState.walls[0].orientation).toBe('horizontal');

      // wallsRemaining de player1 diminue
      const p1 = newState.players.find((p: Player) => p.id === player1Id)!;
      expect(p1.wallsRemaining).toBe(9);
    });

    it('ne devrait pas permettre aux murs de se chevaucher', () => {
      // 1er mur horizontal en (0,1)
      const wall1 = createTestMove({
        type: 'wall',
        playerId: player1Id,
        wallPosition: { x: 0, y: 1 },
        wallOrientation: 'horizontal',
      });
      const state1 = engine.applyMove(gameState, wall1);

      // 2e mur horizontal bord à bord en (1,1) → chevauchement interdit
      const wall2 = createTestMove({
        type: 'wall',
        playerId: player2Id,
        wallPosition: { x: 1, y: 1 },
        wallOrientation: 'horizontal',
      });
      expect(engine.validateMove(state1, wall2)).toBe(false);
    });

    it('ne devrait pas permettre de placer des murs sur les bords du plateau', () => {
      // Horizontal en (8,1) → x doit être ≤ 7 → invalide
      const wallRight = createTestMove({
        type: 'wall',
        playerId: player1Id,
        wallPosition: { x: 8, y: 1 },
        wallOrientation: 'horizontal',
      });
      expect(engine.validateMove(gameState, wallRight)).toBe(false);

      // Vertical en (1,8) → y doit être ≤ 7 → invalide
      const wallBottom = createTestMove({
        type: 'wall',
        playerId: player1Id,
        wallPosition: { x: 1, y: 8 },
        wallOrientation: 'vertical',
      });
      expect(engine.validateMove(gameState, wallBottom)).toBe(false);
    });

    it('ne devrait pas permettre de bloquer complètement un joueur', () => {
      // p1 en (4,1), p2 en (4,8)
      // On entoure p1 : 
      //   - mur horizontal en (4,0) bloque (4,0)<->(4,1)
      //   - mur horizontal en (4,1) bloque (4,1)<->(4,2)
      //   - mur vertical   en (3,1) bloque (3,1)<->(4,1)
      //   - mur vertical   en (4,1) bloque (4,1)<->(5,1)
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

      // Essayer de poser un mur horizontal en (4,2) pour bloquer (4,2)<->(4,3)
      // Mais p1 est déjà complètement encerclé : aucun déplacement possible.
      // Le placement de ce mur devrait être refusé car p1 n’a déjà aucune issue.
      const blockingWall = createTestMove({
        type: 'wall',
        playerId: player2Id,
        wallPosition: { x: 4, y: 2 },
        wallOrientation: 'horizontal',
      });
      expect(engine.validateMove(customState, blockingWall)).toBe(false);
    });
  });

  // ==========================================
  // Tests de victoire
  // ==========================================
  describe('Condition de victoire', () => {
    it("devrait détecter quand un joueur atteint la ligne d'arrivée (2 joueurs)", () => {
      // player1 (index 0) gagne dès qu'il atteint y = 0
      gameState.players[0].position = { x: 4, y: 0 };

      expect(engine.isGameFinished(gameState)).toBe(true);
      expect(engine.getWinner(gameState)).toBe(player1Id);
    });

    it("devrait détecter la victoire dans une partie à 4 joueurs", () => {
      const fourPlayerState = engine.createGame(
        [player1Id, player2Id, player3Id, player4Id],
        4
      );
      // player1 (index 0) doit atteindre y = 0
      fourPlayerState.players[0].position = { x: 4, y: 0 };

      expect(engine.isGameFinished(fourPlayerState)).toBe(true);
      expect(engine.getWinner(fourPlayerState)).toBe(player1Id);
    });
  });

  // ==========================================
  // Tests de cas spéciaux
  // ==========================================
  describe('Cas spéciaux', () => {
    it('devrait gérer correctement les bords du plateau', () => {
      // player1 au coin (0,8), player2 n’importe où
      const customState = createCustomGameState([
        { id: player1Id, position: { x: 0, y: 8 } },
        { id: player2Id, position: { x: 4, y: 0 } },
      ]);

      const validMoves = engine.getValidMoves(customState, player1Id);
      // Seuls (0,7) et (1,8) doivent apparaître
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

      // Pas de déplacement hors plateau (x < 0 ou y > 8)
      expect(
        validMoves.some((m) => m.toPosition?.x === -1)
      ).toBe(false);
      expect(
        validMoves.some((m) => m.toPosition?.y === 9)
      ).toBe(false);
    });

    it('devrait gérer correctement les sauts de pions et les déplacements en diagonale', () => {
      // --- Cas 1 : saut simple dans une partie à 2 joueurs ---
      const stateTwoPawns = createCustomGameState([
        { id: player1Id, position: { x: 4, y: 8 } },
        { id: player2Id, position: { x: 4, y: 7 } },
      ]);

      const jumpOverOne = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 4, y: 6 }, // saut d'un pion
      });
      expect(engine.validateMove(stateTwoPawns, jumpOverOne)).toBe(true);

      // --- Cas 2 : saut multiple interdit dans une partie à 4 joueurs ---
      const fourPlayerEng = new QuoridorEngine();
      const state4 = fourPlayerEng.createGame(
        [player1Id, player2Id, player3Id, player4Id],
        4
      );
      // Positionner 3 pions en (4,8), (4,7), (4,6)
      const p1_4 = state4.players.find((p) => p.id === player1Id)!;
      const p2_4 = state4.players.find((p) => p.id === player2Id)!;
      const p3_4 = state4.players.find((p) => p.id === player3Id)!;
      p1_4.position = { x: 4, y: 8 };
      p2_4.position = { x: 4, y: 7 };
      p3_4.position = { x: 4, y: 6 };

      // Saut de 2 pions (4,8)->(4,5) → interdit
      const jumpOverTwo = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 4, y: 5 },
      });
      expect(fourPlayerEng.validateMove(state4, jumpOverTwo)).toBe(false);

      // --- Cas 3 : diagonale quand mur derrière le pion ---
      const stateWithWallBehind = createCustomGameState(
        [
          { id: player1Id, position: { x: 4, y: 8 } },
          { id: player2Id, position: { x: 4, y: 7 } },
        ],
        [
          // Pour bloquer la jonction (4,7)<->(4,6), on place le mur horizontal en (4,6)
          { position: { x: 4, y: 6 }, orientation: 'horizontal' },
        ]
      );
      const diagonalR = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 5, y: 7 }, // diagonale droite
      });
      const diagonalL = createTestMove({
        type: 'pawn',
        playerId: player1Id,
        fromPosition: { x: 4, y: 8 },
        toPosition: { x: 3, y: 7 }, // diagonale gauche
      });
      expect(engine.validateMove(stateWithWallBehind, diagonalR)).toBe(true);
      expect(engine.validateMove(stateWithWallBehind, diagonalL)).toBe(true);
    });
  });
});
