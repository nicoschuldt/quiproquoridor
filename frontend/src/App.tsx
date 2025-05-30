// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CreateGamePage from './pages/CreateGamePage';
import JoinGamePage from './pages/JoinGamePage';
import RoomLobbyPage from './pages/RoomLobbyPage';
import GamePage from './pages/GamePage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route 
                path="/create-game" 
                element={
                  <ProtectedRoute>
                    <CreateGamePage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/join-game" 
                element={
                  <ProtectedRoute>
                    <JoinGamePage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/room/:roomId" 
                element={
                  <ProtectedRoute>
                    <RoomLobbyPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/game/:roomId" 
                element={
                  <ProtectedRoute>
                    <GamePage />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;