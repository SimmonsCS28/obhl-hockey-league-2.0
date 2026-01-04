import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './components/PublicLayout';
import ScheduleManager from './components/ScheduleManager';
import Scorekeeper from './components/Scorekeeper';
import Home from './components/public/Home';
import PlayersPage from './components/public/PlayersPage';
import SeasonsPage from './components/public/SeasonsPage';
import StandingsPage from './components/public/StandingsPage';
import TeamsPage from './components/public/TeamsPage';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="seasons" element={<SeasonsPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="standings" element={<StandingsPage />} />
            {/* Other public pages will be added here */}
          </Route>

          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/scorekeeper"
            element={
              <ProtectedRoute>
                <Scorekeeper />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <ScheduleManager />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
