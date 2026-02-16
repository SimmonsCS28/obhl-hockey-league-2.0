import { createBrowserRouter, RouterProvider } from 'react-router-dom';
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
import PlayerDashboard from './components/user/PlayerDashboard';
import RefereeShiftSignup from './components/user/RefereeShiftSignup';
import ScorekeeperShiftSignup from './components/user/ScorekeeperShiftSignup';
import UserDashboard from './components/user/UserDashboard';

const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "seasons", element: <SeasonsPage /> },
      { path: "teams", element: <TeamsPage /> },
      { path: "teams/:teamId", element: <TeamRosterPage /> },
      { path: "players", element: <PlayersPage /> },
      { path: "standings", element: <StandingsPage /> },
      { path: "schedule", element: <SchedulePage /> },

      // Public Staff Signups
      // Unified Signup
      { path: "signup", element: <Signup /> },
      { path: "forgot-password", element: <ForgotPassword /> },

      // Legacy Routes - Redirect to unified signup
      { path: "referee/signup", element: <Signup /> },
      { path: "scorekeeper/signup", element: <Signup /> },
      { path: "goalie/signup", element: <Signup /> }
    ]
  },

  // Protected GM Routes
  {
    path: "/gm",
    element: (
      <ProtectedRoute requiredRoles={['GM']}>
        <GMLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <GMDashboard /> },
      { path: "team", element: <GMTeam /> },
      { path: "schedule", element: <GMSchedule /> }
    ]
  },

  // Protected Referee Routes
  {
    path: "/referee",
    element: (
      <ProtectedRoute requiredRoles={['REFEREE']}>
        <RefereeLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <RefereeSchedulePage /> }
    ]
  },

  // Protected Scorekeeper Routes
  {
    path: "/scorekeeper",
    element: (
      <ProtectedRoute requiredRoles={['SCOREKEEPER']}>
        <ScorekeeperLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <ScorekeeperSchedulePage /> },
      { path: "game/:gameId", element: <LiveScoreEntry /> }
    ]
  },

  // Protected Goalie Routes
  {
    path: "/goalie",
    element: (
      <ProtectedRoute requiredRoles={['GOALIE']}>
        <GoalieLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <GoalieSchedulePage /> }
    ]
  },

  // User Shift Management Routes
  {
    path: "/user",
    element: (
      <ProtectedRoute requiredRoles={['USER', 'GOALIE', 'REF', 'SCOREKEEPER']}>
        <PlayerDashboard />
      </ProtectedRoute>
    )
  },
  {
    path: "/user/shifts",
    element: (
      <ProtectedRoute requiredRoles={['GOALIE', 'REF', 'SCOREKEEPER']}>
        <UserDashboard />
      </ProtectedRoute>
    )
  },
  {
    path: "/user/goalie",
    element: (
      <ProtectedRoute requiredRoles={['GOALIE']}>
        <GoalieShiftSignup />
      </ProtectedRoute>
    )
  },
  {
    path: "/user/referee",
    element: (
      <ProtectedRoute requiredRoles={['REF']}>
        <RefereeShiftSignup />
      </ProtectedRoute>
    )
  },
  {
    path: "/user/scorekeeper",
    element: (
      <ProtectedRoute requiredRoles={['SCOREKEEPER']}>
        <ScorekeeperShiftSignup />
      </ProtectedRoute>
    )
  },

  // Protected Admin Routes
  {
    path: "/admin",
    element: (
      <ProtectedRoute requiredRoles={['ADMIN']}>
        <AdminDashboard />
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/schedule",
    element: (
      <ProtectedRoute requiredRoles={['ADMIN']}>
        <AdminLayout>
          <ScheduleManager />
        </AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/teams/:teamId",
    element: (
      <ProtectedRoute requiredRoles={['ADMIN']}>
        <AdminLayout activeTab="teams">
          <TeamDetails onBack={() => window.history.back()} />
        </AdminLayout>
      </ProtectedRoute>
    )
  },

  // Change Password Route
  {
    path: "/change-password",
    element: <ChangePassword />
  }
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
