import { useSearchParams } from 'react-router-dom';
import GoalieSchedule from './admin/GoalieSchedule';
import RefereeSchedule from './admin/RefereeSchedule';
import ScorekeeperSchedule from './admin/ScorekeeperSchedule';
import AdminOverview from './admin/AdminOverview';
import AdminAssignments from './admin/AdminAssignments';
import GameManagementAdmin from './admin/GameManagementAdmin';
import AdminLayout from './AdminLayout';
import DraftDashboard from './DraftDashboard';
import PlayerManagement from './PlayerManagement';
import ScorekeeperContent from './ScorekeeperContent';
import SeasonManagement from './SeasonManagement';
import TeamManagement from './TeamManagement';
import UserManagement from './UserManagement';
import AnnouncementsManagement from './admin/AnnouncementsManagement';
import LeagueRulesAdmin from './LeagueRulesAdmin';

function AdminDashboard() {
    const [searchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    // Map legacy tab id to new equivalent; derive directly from URL (no intermediate state)
    const activeTab = tabFromUrl === 'gameManagement' ? 'livescore' : (tabFromUrl || 'overview');

    return (
        <AdminLayout activeTab={activeTab}>
            {activeTab === 'overview' && <AdminOverview />}
            {activeTab === 'livescore' && <ScorekeeperContent />}
            {activeTab === 'gamemgmt' && <GameManagementAdmin />}
            {activeTab === 'assignments' && <AdminAssignments />}
            {activeTab === 'teams' && <TeamManagement />}
            {activeTab === 'players' && <PlayerManagement />}
            {activeTab === 'seasons' && <SeasonManagement />}
            {activeTab === 'draft' && <DraftDashboard />}
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'announcements' && <AnnouncementsManagement />}
            {activeTab === 'rules' && <LeagueRulesAdmin />}
            {activeTab === 'goalies' && <GoalieSchedule />}
            {activeTab === 'referees' && <RefereeSchedule />}
            {activeTab === 'scorekeepers' && <ScorekeeperSchedule />}
        </AdminLayout>
    );
}

export default AdminDashboard;
