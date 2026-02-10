import { Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from 'react-router-dom';
import './App.css';
import AdminDashboard from './components/AdminDashboard';
import AdminLayout from './components/AdminLayout';
import GMLayout from './components/GMLayout';
import LiveScoreEntry from './components/LiveScoreEntry';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './components/PublicLayout';
import ScheduleManager from './components/ScheduleManager';
import SchedulePage from './components/SchedulePage';
import Scorekeeper from './components/Scorekeeper';
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

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="seasons" element={<SeasonsPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="teams/:teamId" element={<TeamRosterPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="standings" element={<StandingsPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        {/* Other public pages will be added here */}
      </Route>

      {/* Protected GM Routes */}
      <Route path="/gm" element={
        <ProtectedRoute>
          <GMLayout />
        </ProtectedRoute>
      }>
        <Route index element={<GMDashboard />} />
        <Route path="team" element={<GMTeam />} />
        <Route path="schedule" element={<GMSchedule />} />
      </Route>

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
        path="/scorekeeper/game/:gameId"
        element={
          <ProtectedRoute>
            <LiveScoreEntry />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/schedule"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <ScheduleManager />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/teams/:teamId"
        element={
          <ProtectedRoute>
            <AdminLayout activeTab="teams">
              <TeamDetails onBack={() => window.history.back()} />
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* Change Password Route - No auth required since user must be logged in to get here */}
      <Route path="/change-password" element={<ChangePassword />} />
    </>
  )
);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
