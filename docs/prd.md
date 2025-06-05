# Quoridor Game - Product Requirements Document

## Project Overview
Digital implementation of the board game Quoridor with multiplayer support. Focus on core gameplay and room-based multiplayer functionality.

**Timeline:** 5 days  
**Team:** 2 developers (multiplayer + game logic split)

## Core Features (MVP)

### 1. User Authentication (Simple)
- Username/password registration and login
- JWT-based session management
- Basic user profile (username, games played)
- Guest mode for quick play (optional)

### 2. Game Rooms
- Create game room (2 or 4 players)
- Join room with room code
- Player ready/unready system
- Real-time player status updates
- Handle player disconnection/reconnection

### 2. Core Gameplay
- 9x9 game board visualization
- Pawn movement (orthogonal, one square)
- Wall placement (horizontal/vertical between squares)
- Jump mechanics when pawns face each other
- Turn-based gameplay with clear current player indication

### 3. Game Rules Enforcement
- Move validation (legal pawn moves, wall placement)
- Wall count tracking (10 per player in 2P, 5 per player in 4P)
- Path validation (always maintain route to goal)
- Win condition (reach opposite side)
- Game state synchronization across all players

### 4. User Interface
- Clean game board with clear grid
- Wall placement preview/confirmation
- Available move highlighting
- Game status display (current turn, walls remaining)
- Simple room creation/joining flow

## Technical Requirements

### Performance
- Sub-100ms move response time
- Handle up to 10 concurrent games
- Reliable real-time synchronization

### Compatibility
- Modern web browsers (Chrome, Firefox, Safari)
- Responsive design (desktop + tablet)

### Data Persistence
- User accounts and basic profiles
- Game state recovery on reconnection
- Basic game history per user

### Deployment
- Docker Compose for single-command local deployment
- Environment-based configuration
- Included database container (PostgreSQL)
- Production-ready with minimal configuration changes

## User Stories

### Authentication
- As a new user, I can create an account with username/password
- As a returning user, I can log in to access my profile
- As a user, I can see my basic stats (games played, wins)

### Room Management
- As a player, I can create a new game room
- As a player, I can join a room using a room code
- As a player, I can see who's in my room and their ready status
- As a player, I can leave a room before the game starts

### Gameplay
- As a player, I can move my pawn to adjacent squares
- As a player, I can place walls to block paths
- As a player, I can see when it's my turn
- As a player, I can see how many walls I have left
- As a player, I get feedback when I try invalid moves
- As a player, I can see when someone wins

### Real-time Features
- As a player, I see other players' moves immediately
- As a player, I can rejoin if I disconnect
- As a player, I see when others disconnect

## Success Criteria
- [ ] Simple user registration and login works
- [ ] Professor can run entire app with `docker-compose up`
- [ ] 2 players can create/join room and play complete game
- [ ] 4 players can play simultaneously  
- [ ] All Quoridor rules correctly implemented
- [ ] Real-time synchronization works reliably
- [ ] Intuitive UI for wall placement and movement
- [ ] Game handles disconnections gracefully

## Future Enhancements (Post-MVP)
- AI opponents with difficulty levels
- shop: boards, pawns
- 
## Non-Goals (Scope Exclusions)
- Real-time chat
- Advanced graphics/animations
- Monetization features
- Social features
- Custom game variants

## Risk Mitigation
- **Multiplayer sync complexity:** Start with turn-based approach, avoid real-time movement
- **Game logic bugs:** Comprehensive test coverage for rule validation
- **Performance issues:** Limit concurrent games, optimize state updates
- **UI complexity:** Keep interface minimal, focus on functionality over aesthetics