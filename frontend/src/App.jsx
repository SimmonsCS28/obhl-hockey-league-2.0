import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import AdminDashboard from './components/AdminDashboard';
import AdminLayout from './components/AdminLayout';
import GMLayout from './components/GMLayout';
import LiveScoreEntry from './components/LiveScoreEntry';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './components/PublicLayout';
import ScheduleManager from './components/ScheduleManager';
import SchedulePage from './components/SchedulePage';
import TeamDetails from './components/TeamDetails';
import GMDashboard from './components/gm/GMDashboard';
import GMSchedule from './components/gm/GMSchedule';
import GMTeam from './components/gm/GMTeam';
import Home from './components/public/Home';
import PlayersPage from './components/public/PlayersPage';
import SeasonsPage from './components/public/SeasonsPage';
import StandingsPage from './components/public/StandingsPage';
import TeamRosterPage from './components/public/TeamRosterPage';
import TeamsPage from './components/public/TeamsPage';
import { AuthProvider } from './contexts/AuthContext';
import ChangePassword from './pages/ChangePassword';

// New Staff Components
import GoalieLayout from './components/GoalieLayout';
import RefereeLayout from './components/RefereeLayout';
import ScorekeeperLayout from './components/ScorekeeperLayout';
import Signup from './components/Signup';
import GoalieSchedulePage from './components/goalie/GoalieSchedulePage';
import RefereeSchedulePage from './components/referee/RefereeSchedulePage';
import ScorekeeperSchedulePage from './components/scorekeeper/ScorekeeperSchedulePage';

// User Shift Management Components
import ForgotPassword from './components/ForgotPassword';
import GoalieShiftSignup from './components/user/GoalieShiftSignup';
import RefereeShiftSignup from './components/user/RefereeShiftSignup';
import ScorekeeperShiftSignup from './components/user/ScorekeeperShiftSignup';
import UserDashboard from './components/user/UserDashboard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="seasons" element={<SeasonsPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="teams/:teamId" element={<TeamRosterPage />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="standings" element={<StandingsPage />} />
            <Route path="schedule" element={<SchedulePage />} />

            {/* Public Staff Signups */}
            {/* Unified Signup */}
            <Route path="signup" element={<Signup />} />
            <Route path="forgot-password" element={<ForgotPassword />} />

            {/* Legacy Routes - Redirect to unified signup */}
            <Route path="referee/signup" element={<Signup />} />
            <Route path="scorekeeper/signup" element={<Signup />} />
            <Route path="goalie/signup" element={<Signup />} />
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

          {/* User Shift Management Routes */}
          <Route path="/user" element={
            <ProtectedRoute requiredRoles={['GOALIE', 'REF', 'SCOREKEEPER']}>
              <UserDashboard />
            </ProtectedRoute>
          } />
          <Route path="/user/goalie" element={
            <ProtectedRoute requiredRoles={['GOALIE']}>
              <GoalieShiftSignup />
            </ProtectedRoute>
          } />
          <Route path="/user/referee" element={
            <ProtectedRoute requiredRoles={['REF']}>
              <RefereeShiftSignup />
            </ProtectedRoute>
          } />
          <Route path="/user/scorekeeper" element={
            <ProtectedRoute requiredRoles={['SCOREKEEPER']}>
              <ScorekeeperShiftSignup />
            </ProtectedRoute>
          } />

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
                <AdminLayout>
                  <ScheduleManager />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/teams/:teamId"
            element={
              <ProtectedRoute requiredRoles={['ADMIN']}>
                <AdminLayout activeTab="teams">
                  <TeamDetails onBack={() => window.history.back()} />
                </AdminLayout>
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
