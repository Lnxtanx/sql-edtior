/**
 * Settings Modal
 * 
 * Main container for the settings interface. Uses a sidebar navigation
 * pattern to switch between different setting sections.
 */

import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SettingsSidebar } from './SettingsSidebar';
import { ProfileSettings } from './ProfileSettings';
import { CollaborationSettings } from './CollaborationSettings';
import { PlansSettings } from './PlansSettings';
import { UsageSettings } from './UsageSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { ShortcutsSettings } from './ShortcutsSettings';
import { DocumentationSettings } from './DocumentationSettings';
import { ProjectSettings } from './ProjectSettings';
import { SettingsSection } from './types';
import { Project } from '@/lib/file-management/api/client';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: User | Partial<User> | null;
    signOut?: () => void;
    signInWithGoogle?: () => void;
    currentProjectId?: string | null;
    projects?: Project[];
    onProjectsUpdate?: () => void;
}

export function SettingsModal({ isOpen, onClose, user, signOut, signInWithGoogle, currentProjectId, projects = [], onProjectsUpdate }: SettingsModalProps) {
    const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

    const renderContent = () => {
        switch (activeSection) {
            case 'profile':
                return <ProfileSettings user={user as User | null} signOut={signOut} signInWithGoogle={signInWithGoogle} onNavigate={setActiveSection} />;
            case 'project':
                return <ProjectSettings projects={projects} currentProjectId={currentProjectId} onCloseModal={onClose} onProjectsUpdate={onProjectsUpdate} />;
            case 'collaboration':
                return (
                    <CollaborationSettings 
                        user={user as User | null} 
                        projects={projects}
                        onNavigateToProject={(id) => {
                            // First select the project in ProjectSettings state if possible
                            // For now, just switch to project section
                            setActiveSection('project');
                        }}
                    />
                );
            case 'usage':
                return <UsageSettings />;
            case 'plans':
                return <PlansSettings />;
            case 'appearance':
                return <AppearanceSettings />;
            case 'shortcuts':
                return <ShortcutsSettings />;
            case 'documentation':
                return <DocumentationSettings />;
            default:
                return <ProfileSettings user={user as User | null} signOut={signOut} signInWithGoogle={signInWithGoogle} />;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl h-[90vh] max-h-[700px] p-0 gap-0 overflow-hidden flex flex-col">
                <VisuallyHidden>
                    <DialogTitle>Settings</DialogTitle>
                </VisuallyHidden>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <SettingsSidebar
                        activeSection={activeSection}
                        onSelect={setActiveSection}
                        user={user}
                    />

                    {/* Content Area */}
                    <ScrollArea className="flex-1 [&_[data-radix-scroll-area-thumb]]:w-1 [&_[data-radix-scroll-area-thumb]]:rounded-full">
                        {renderContent()}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
