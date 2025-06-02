# Quoridor Board Implementation Plan

## 🎯 Division of Responsibilities

### **Frontend (You) - Board Interface & Interaction**
- Visual board rendering (17x17 grid system)
- User interaction handling (clicks, hover states)
- Move visualization and feedback
- Real-time state synchronization
- UI components and styling

---

## 📐 Coordinate System Specification

### **Game Coordinates (What Oscar Works With)**

**Pawn Positions: 9x9 Grid**
```
Position (row, col) where both range 0-8
- (0,4) = Top center (Player 2 start)
- (8,4) = Bottom center (Player 1 start)
- (4,4) = Center of board
```

**Wall Positions: 8x8 Grid**
```
Position (row, col) where both range 0-7
- Horizontal wall (r,c) blocks between pawn rows r and r+1
- Vertical wall (r,c) blocks between pawn cols c and c+1
```

### **Visual Coordinates (What You Work With)**

**17x17 Display Grid**
```
- Even row, even col (0,0), (0,2), (2,0), etc. = Pawn cells
- Odd row, even col (1,0), (1,2), (3,0), etc. = Horizontal wall cells  
- Even row, odd col (0,1), (0,3), (2,1), etc. = Vertical wall cells
- Odd row, odd col (1,1), (1,3), (3,1), etc. = Corner intersections (non-interactive)
```

**Coordinate Conversion**
```
Visual → Game:
- Pawn: game_pos = visual_pos / 2
- H-Wall: game_row = (visual_row - 1) / 2, game_col = visual_col / 2  
- V-Wall: game_row = visual_row / 2, game_col = (visual_col - 1) / 2

Game → Visual:
- Pawn: visual_pos = game_pos * 2
- H-Wall: visual_row = game_row * 2 + 1, visual_col = game_col * 2
- V-Wall: visual_row = game_row * 2, visual_col = game_col * 2 + 1
```

---

## 🎮 Move System Specification

### **Move Format (Shared Interface)**
```typescript
interface Move {
  type: 'pawn' | 'wall';
  playerId: string;
  
  // For pawn moves
  toPosition?: Position;
  
  // For wall placement  
  wallPosition?: Position;
  wallOrientation?: 'horizontal' | 'vertical';
}

interface Position {
  x: number; // col (0-8 for pawns, 0-7 for walls)
  y: number; // row (0-8 for pawns, 0-7 for walls)
}
```

### **Game State Structure (Shared)**
```typescript
interface GameState {
  players: Player[];
  walls: Wall[];
  currentPlayerIndex: number;
  status: 'playing' | 'finished';
  winner?: string;
}

interface Player {
  id: string;
  position: Position; // Current pawn position (game coords)
  wallsRemaining: number;
  color: PlayerColor;
}

interface Wall {
  position: Position; // Wall position (game coords) 
  orientation: 'horizontal' | 'vertical';
  playerId: string;
}
```

---

## 🔗 Frontend-Backend Interface

### **What Frontend Sends to Backend**
```typescript
// Move validation request
validateMove(gameState: GameState, move: Move): boolean

// Move execution request  
applyMove(gameState: GameState, move: Move): GameState

// Available moves query
getValidMoves(gameState: GameState, playerId: string): Move[]
```

### **What Backend Provides to Frontend**
```typescript
class GameEngine {
  // Core validation
  validateMove(gameState: GameState, move: Move): boolean;
  applyMove(gameState: GameState, move: Move): GameState;
  
  // Move generation
  getValidMoves(gameState: GameState, playerId: string): Move[];
  getValidPawnMoves(gameState: GameState, playerId: string): Position[];
  getValidWallPlacements(gameState: GameState, playerId: string): WallPlacement[];
  
  // Game state queries
  isGameFinished(gameState: GameState): boolean;
  getWinner(gameState: GameState): string | null;
  
  // Utility methods
  hasValidPathToGoal(gameState: GameState, playerId: string): boolean;
  isPositionBlocked(gameState: GameState, from: Position, to: Position): boolean;
}
```

---

## 🏗️ Frontend Implementation Structure

### **Component Hierarchy**
```
GamePage
├── GameBoard
│   ├── BoardGrid (17x17 layout)
│   ├── PawnComponent (x2 or x4)
│   ├── WallComponent (multiple)
│   └── MoveFeedback (highlights, shadows)
├── GameSidebar
│   ├── PlayerInfo
│   ├── WallCounter  
│   └── GameControls
└── GameStatus
```

### **State Management Pattern**
```typescript
// Main game state (from WebSocket)
const [gameState, setGameState] = useState<GameState>();

// UI interaction state
const [selectedMove, setSelectedMove] = useState<Move | null>(null);
const [validMoves, setValidMoves] = useState<Move[]>([]);
const [hoveredCell, setHoveredCell] = useState<Position | null>(null);

// Visual feedback state
const [highlightedCells, setHighlightedCells] = useState<Position[]>([]);
const [wallPreview, setWallPreview] = useState<WallPlacement | null>(null);
```

### **Interaction Flow**
1. **User hovers cell** → Show move preview
2. **User clicks valid cell** → Create move object
3. **Send to validation** → GameEngine.validateMove()
4. **If valid** → Send via WebSocket
5. **Receive update** → Update visual state
6. **If invalid** → Show error feedback

---

## 🎨 Visual Design Requirements

### **Board Styling**
- **Pawn cells**: Square, clearly defined borders
- **Wall cells**: Rectangular (thinner), hover effects
- **Current player**: Highlight valid moves
- **Move preview**: Semi-transparent overlays
- **Walls**: Solid bars blocking pathways
- **Turn indicator**: Clear current player display

### **Responsive Behavior**
- **Desktop**: Hover previews, click to move
- **Minimum size**: Playable on 320px width
- **Aspect ratio**: Maintain square board proportion

### **Visual Feedback**
- **Valid moves**: Green highlight/border
- **Invalid moves**: Red flash/shake
- **Wall preview**: Dotted overlay
- **Current turn**: Player color border
- **Wall count**: Visual counter per player

---

## 📱 Touch/Mobile Considerations

### **Interaction Modes**
```typescript
// Desktop: Direct click
const handleCellClick = (position: Position) => {
  if (isValidMove(position)) {
    executeMove(createMove(position));
  }
};

// Mobile: Select + confirm
const handleCellTap = (position: Position) => {
  setSelectedMove(createMove(position));
  showConfirmDialog();
};
```

### **UI Adaptations**
- **Confirm/Cancel buttons** for mobile
- **Larger touch targets** (min 44px)
- **Gesture support** for wall orientation
- **Visual selection state** before confirm

---

## 🔄 Real-time Integration Points

### **WebSocket Events**
```typescript
// Outgoing
socket.emit('make-move', { roomId, move });
socket.emit('request-valid-moves', { roomId, playerId });

// Incoming  
socket.on('move-made', ({ move, gameState }) => {
  updateBoard(gameState);
  showMoveAnimation(move);
});

socket.on('invalid-move', ({ error, move }) => {
  showError(error);
  resetMoveSelection();
});

socket.on('game-finished', ({ winner, gameState }) => {
  showGameResult(winner);
  disableBoard();
});
```

### **State Synchronization**
- **Optimistic updates**: Show move immediately, rollback if invalid
- **Conflict resolution**: Server state always wins
- **Reconnection**: Request full game state on reconnect
- **Move history**: Track for undo/replay features

---

## 🧪 Development Strategy

### **Phase 1: Static Board (Day 1)**
- Render 17x17 grid with proper cell types
- Position pawns at starting locations
- Style board with Tailwind classes
- Implement coordinate conversion utilities

### **Phase 2: Basic Interaction (Day 2)**  
- Add click handlers for pawn movement
- Implement wall placement interface
- Create move preview system
- Add visual feedback for valid/invalid moves

### **Phase 3: Mock Logic Integration (Day 2-3)**
- Create mock GameEngine with basic validation
- Connect UI to mock engine
- Test move flows end-to-end
- Refine interaction patterns

### **Phase 4: Real Logic Integration (Day 3-4)**
- Replace mock with Oscar's GameEngine
- Handle complex validation scenarios
- Test edge cases and error conditions
- Optimize performance

### **Phase 5: Real-time & Polish (Day 4-5)**
- Connect to WebSocket events
- Add animations and transitions
- Implement mobile adaptations
- Final testing and bug fixes

---

## 🎯 Success Criteria

### **Functional Requirements**
- ✅ Players can move pawns to valid positions
- ✅ Players can place walls in valid locations  
- ✅ Invalid moves are prevented with clear feedback
- ✅ Game state synchronizes across all players
- ✅ Win conditions are detected and displayed

### **User Experience Requirements**
- ✅ Board is intuitive and visually clear
- ✅ Interactions feel responsive and natural
- ✅ Mobile experience is fully functional
- ✅ Error states are handled gracefully
- ✅ Game flows smoothly from start to finish

This plan provides clear boundaries between frontend and backend work while ensuring seamless integration. The coordinate system is precisely defined, and the interfaces are clean and testable.