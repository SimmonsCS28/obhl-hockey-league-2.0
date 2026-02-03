import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import AdminDashboard from './components/AdminDashboard';
import GMLayout from './components/GMLayout';
import LiveScoreEntry from './components/LiveScoreEntry';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './components/PublicLayout';
import ScheduleManager from './components/ScheduleManager';
import SchedulePage from './components/SchedulePage';
import GMDashboard from './components/gm/GMDashboard';
import GMSchedule from './components/gm/GMSchedule';
import GMTeam from './components/gm/GMTeam';
import Home from './components/public/Home';
import PlayersPage from './components/public/PlayersPage';
import SeasonsPage from './components/public/SeasonsPage';
import StandingsPage from './components/public/StandingsPage';
import TeamsPage from './components/public/TeamsPage';
import { AuthProvider } from './contexts/AuthContext';
import ChangePassword from './pages/ChangePassword';

// New Staff Components
import GoalieLayout from './components/GoalieLayout';
import RefereeLayout from './components/RefereeLayout';
import ScorekeeperLayout from './components/ScorekeeperLayout';
import GoalieSchedulePage from './components/goalie/GoalieSchedulePage';
import RefereeSchedulePage from './components/referee/RefereeSchedulePage';
import RefereeSignup from './components/referee/RefereeSignup';
import ScorekeeperSchedulePage from './components/scorekeeper/ScorekeeperSchedulePage';
import ScorekeeperSignup from './components/scorekeeper/ScorekeeperSignup';

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
            <Route path="schedule" element={<SchedulePage />} />

            {/* Public Staff Signups */}
            <Route path="referee/signup" element={<RefereeSignup />} />
            <Route path="scorekeeper/signup" element={<ScorekeeperSignup />} />
          </Route>

          {/* Protected GM Routes */}
          <Route path="/gm" element={
            <ProtectedRoute requiredRoles={['GM']}>
              <GMLayout />
            </ProtectedRoute>
          }>
            <Route index element={<GMDashboard />} />
            <Route path="team" element={<GMTeam />} />
            <Route path="schedule" element={<GMSchedule />} />
          </Route>

          {/* Protected Referee Routes */}
          <Route path="/referee" element={
            <ProtectedRoute requiredRoles={['REFEREE']}>
              <RefereeLayout />
            </ProtectedRoute>
          }>
            <Route index element={<RefereeSchedulePage />} />
          </Route>

          {/* Protected Scorekeeper Routes */}
          <Route path="/scorekeeper" element={
            <ProtectedRoute requiredRoles={['SCOREKEEPER']}>
              <ScorekeeperLayout />
            </ProtectedRoute>
          }>
            <Route index element={<ScorekeeperSchedulePage />} />
            <Route path="game/:gameId" element={<LiveScoreEntry />} />
          </Route>

          {/* Protected Goalie Routes */}
          <Route path="/goalie" element={
            <ProtectedRoute requiredRoles={['GOALIE']}>
              <GoalieLayout />
            </ProtectedRoute>
          }>
            <Route index element={<GoalieSchedulePage />} />
          </Route>

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/schedule"
            element={
              <ProtectedRoute requiredRoles={['ADMIN']}>
                <ScheduleManager />
              </ProtectedRoute>
            }
          />

          {/* Change Password Route - No auth required since user must be logged in to get here */}
          <Route path="/change-password" element={<ChangePassword />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
