import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import DraftDashboard from './DraftDashboard';
import PlayerManagement from './PlayerManagement';
import ScorekeeperContent from './ScorekeeperContent';
import SeasonManagement from './SeasonManagement';
import TeamManagement from './TeamManagement';
import UserManagement from './UserManagement';

function AdminDashboard() {
    const [searchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(tabFromUrl || 'teams');

    useEffect(() => {
        if (tabFromUrl) {
            setActiveTab(tabFromUrl);
        }
    }, [tabFromUrl]);

    return (
        <AdminLayout activeTab={activeTab}>
            {activeTab === 'teams' && <TeamManagement />}
            {activeTab === 'players' && <PlayerManagement />}
            {activeTab === 'seasons' && <SeasonManagement />}
            {activeTab === 'draft' && <DraftDashboard />}
            {activeTab === 'gameManagement' && <ScorekeeperContent />}
            {activeTab === 'users' && <UserManagement />}
        </AdminLayout>
    );
}

export default AdminDashboard;
