import { AnimatePresence } from 'framer-motion';
import { Table } from '@/lib/sql-parser';
import { GraphStats, SchemaGraph } from '@/lib/schema-workspace';
import { TableEditPanel } from '../panels/TableEditPanel';
import { GraphSettingsPanel } from '../panels/GraphSettingsPanel';
import { TerminalPanel } from './TerminalPanel';

interface DiagramModalsProps {
    editingTable?: Table | null;
    allTables: Table[];
    onEditChange?: (table: Table) => void;
    onEditClose?: () => void;

    showGraphSettings: boolean;
    subgraphConfig: any;
    onSubgraphConfigChange?: (config: any) => void;
    localStats: GraphStats | null;
    graphSettingsTab: 'settings' | 'impact';
    graph: SchemaGraph | null;
    onGraphSettingsClosed?: () => void;
    setShowGraphSettings: (show: boolean) => void;

    showTerminal: boolean;
    setShowTerminal: (show: boolean) => void;
    linkedConnectionId: string | null;
    linkedConnection: any;
    fileName: string | undefined;
    onApplySQL?: (sql: string) => void;
}

export function DiagramModals({
    editingTable,
    allTables,
    onEditChange,
    onEditClose,

    showGraphSettings,
    subgraphConfig,
    onSubgraphConfigChange,
    localStats,
    graphSettingsTab,
    graph,
    onGraphSettingsClosed,
    setShowGraphSettings,

    showTerminal,
    setShowTerminal,
    linkedConnectionId,
    linkedConnection,
    fileName,
    onApplySQL
}: DiagramModalsProps) {
    return (
        <>
            <AnimatePresence>
                {editingTable && onEditChange && onEditClose && (
                    <TableEditPanel
                        table={editingTable}
                        allTables={allTables}
                        onSave={onEditChange}
                        onClose={onEditClose}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showGraphSettings && subgraphConfig && onSubgraphConfigChange && (
                    <GraphSettingsPanel
                        config={subgraphConfig}
                        onConfigChange={onSubgraphConfigChange}
                        stats={localStats}
                        defaultTab={graphSettingsTab}
                        graph={graph}
                        onClose={() => { setShowGraphSettings(false); onGraphSettingsClosed?.(); }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showTerminal && (
                    <TerminalPanel
                        isOpen={showTerminal}
                        onClose={() => setShowTerminal(false)}
                        connectionId={linkedConnectionId}
                        connectionName={linkedConnection?.name}
                        fileName={fileName}
                        onApplySQL={onApplySQL}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
