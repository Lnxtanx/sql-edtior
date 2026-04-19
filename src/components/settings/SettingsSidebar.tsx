/**
 * Settings Sidebar
 * 
 * Navigation sidebar for the settings modal with icon + text items.
 */

import type { ElementType } from 'react';
import { User, CreditCard, Palette, Keyboard, BookOpen, Users, Folder, BarChart3, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SettingsSection } from './types';
import { useCapabilities } from '@/hooks/useCapabilities';

interface SettingsSidebarProps {
    activeSection: SettingsSection;
    onSelect: (section: SettingsSection) => void;
    user?: any;
}

const SECTIONS: { id: SettingsSection; label: string; icon: ElementType; requiredFeature?: string }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'project', label: 'Project', icon: Folder, requiredFeature: 'sql_editor' },
    { id: 'collaboration', label: 'Collaboration', icon: Users },
    { id: 'usage', label: 'Usage', icon: BarChart3 },
    { id: 'plans', label: 'Plans & Billing', icon: CreditCard },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
    { id: 'documentation', label: 'Documentation', icon: BookOpen },
];

export function SettingsSidebar({ activeSection, onSelect, user }: SettingsSidebarProps) {
    const { canAccessSQL } = useCapabilities();

    // Filter sections based on capabilities
    const visibleSections = SECTIONS.filter(section => {
        if (!section.requiredFeature) return true;
        if (section.requiredFeature === 'sql_editor') return canAccessSQL;
        return true;
    });
    return (
        <div className="w-48 border-r border-border bg-muted/30 flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Settings</h2>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1">
                {visibleSections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;

                    return (
                        <button
                            key={section.id}
                            onClick={() => onSelect(section.id)}
                            className={cn(
                                "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
                                isActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{section.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/20">
                <div className="flex items-center justify-center cursor-default py-1 whitespace-nowrap">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/60">
                        SQL Editor <span className="text-[8px] font-medium opacity-70 ml-1.5">v1.0.0</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
