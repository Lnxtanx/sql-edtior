// =============================================================================
// Database Admin Page
// Full-screen database management workspace with migrations, config, health
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useConnections } from '@/lib/api/connection';
import { Loader2 } from 'lucide-react';
import { DatabaseAdminLayout } from '@/components/database-admin';
import { ConnectionFormModal } from '@/components/connection/form/ConnectionFormModal';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { SEO, SEO_PAGES, getCanonicalUrl } from '@/lib/seo';

type TabType = 'overview' | 'migrations' | 'config' | 'health' | 'security' | 'audit';

export default function DatabaseAdminPage() {
  const { loading: authLoading, user, signOut } = useAuth();
  const { data: connections } = useConnections();
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Modal states
  const [isAddConnectionOpen, setIsAddConnectionOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const pageSeo = SEO_PAGES.databases;

  const selectedDatabaseName = useMemo(() => {
    if (!selectedDatabaseId || !connections) return undefined;
    return connections.find(c => c.id === selectedDatabaseId)?.name;
  }, [selectedDatabaseId, connections]);

  const handleDatabaseSelect = useCallback((dbId: string) => {
    setSelectedDatabaseId(dbId);
    setActiveTab('overview');
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleAddDatabase = useCallback(() => {
    setIsAddConnectionOpen(true);
  }, []);

  const handleSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleConnectioFormClose = useCallback(() => {
    setIsAddConnectionOpen(false);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <>
      <SEO title={pageSeo.title} description={pageSeo.description} canonical={getCanonicalUrl(pageSeo.path)} />
      <div className="h-screen flex flex-col bg-background">
        <DatabaseAdminLayout
          selectedDatabaseId={selectedDatabaseId}
          selectedDatabaseName={selectedDatabaseName}
          onDatabaseSelect={handleDatabaseSelect}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onAddDatabaseClick={handleAddDatabase}
          onSettingsClick={handleSettings}
        />
      </div>

      {/* Connection Form Modal */}
      <ConnectionFormModal
        isOpen={isAddConnectionOpen}
        onClose={handleConnectioFormClose}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleSettingsClose}
        user={user}
        signOut={signOut}
      />
    </>
  );
}
