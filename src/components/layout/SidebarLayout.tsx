import { useState } from "react";
import { ActivityBar } from "./ActivityBar";
import { SidePanel, SidePanelSplit } from "./SidePanel";
import { SidebarView } from "./types";

interface SidebarLayoutProps {
    // State
    activeView: SidebarView;
    onViewChange: (view: SidebarView) => void;

    isCollapsed: boolean;
    secondaryView: SidebarView | null; // For split view

    // Header/Footer Content for SidePanel
    panelHeader?: React.ReactNode;
    panelFooter?: React.ReactNode;
    panelFullScreen?: boolean;


    onOpenSettings?: () => void;
    onToggleCollapse?: () => void;

    // View Contents
    renderView: (view: SidebarView) => React.ReactNode;

    // Main Content (Right side of the split)
    children?: React.ReactNode;
}

export function SidebarLayout({
    activeView,
    onViewChange,
    isCollapsed,
    secondaryView,
    panelHeader,
    panelFooter,
    panelFullScreen,
    onOpenSettings,
    renderView,
    children,
    onToggleCollapse
}: SidebarLayoutProps) {
    const [sidebarWidth, setSidebarWidth] = useState(380);

    return (
        <div className="flex h-full w-full bg-background overflow-hidden animate-in fade-in duration-300">
            {/* 1. Sidebar Area: Either Activity Bar (Icons) OR Side Panel (Content) */}
            {isCollapsed ? (
                /* Collapsed State: Show Icons Only */
                <ActivityBar
                    activeView={activeView}
                    onViewChange={onViewChange}
                    onOpenSettings={onOpenSettings}
                    onToggleCollapse={onToggleCollapse}
                />
            ) : (
                /* Expanded State: Show Content Panel */
                <SidePanel
                    isVisible={true}
                    onWidthChange={setSidebarWidth}
                    defaultWidth={sidebarWidth}
                    header={panelHeader}
                    footer={panelFooter}
                    fullScreen={panelFullScreen}
                >
                    {secondaryView ? (
                        <SidePanelSplit
                            visible={true}
                            primary={renderView(activeView)}
                            secondary={renderView(secondaryView)}
                        />
                    ) : (
                        renderView(activeView)
                    )}
                </SidePanel>
            )}

            {/* 2. Main Content Area (Diagram) */}
            <div className="flex-1 min-w-0 bg-secondary/5 h-full relative">
                {children}
            </div>
        </div>
    );
}
