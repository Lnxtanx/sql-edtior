// =============================================================================
// Tab Navigation
// Horizontal tab navigation for database admin workspace
// =============================================================================

import { cn } from '@/lib/utils';
import {
  BarChart3,
  GitBranch,
  Settings,
  Heart,
  Shield,
  FileText,
} from 'lucide-react';

export type TabType = 'overview' | 'migrations' | 'config' | 'health' | 'security' | 'audit';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TABS = [
  { id: 'overview' as TabType, label: 'Overview', icon: BarChart3 },
  { id: 'migrations' as TabType, label: 'Migrations', icon: GitBranch },
  { id: 'config' as TabType, label: 'Configuration', icon: Settings },
  { id: 'health' as TabType, label: 'Health', icon: Heart },
  { id: 'security' as TabType, label: 'Security', icon: Shield },
  { id: 'audit' as TabType, label: 'Audit', icon: FileText },
];

export function TabNavigation({
  activeTab,
  onTabChange,
}: TabNavigationProps) {
  return (
    <div className="flex items-center gap-0.5 px-4 border-b border-border bg-card h-9 shrink-0 overflow-x-auto scrollbar-hide">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 h-8 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0',
            activeTab === id
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
