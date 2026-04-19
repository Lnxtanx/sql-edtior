import { useState, useEffect, useMemo } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X, Key, Link, Sparkles, Save, Code, LayoutGrid, AlertCircle, GripHorizontal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table } from '@/lib/sql-parser';
import { cn } from '@/lib/utils';
import { useTableEditor, EditorMode } from './hooks/useTableEditor';
import { usePanelResize } from './hooks/usePanelResize';
import { VisualColumnEditor } from './components/VisualColumnEditor';

interface TableEditPanelProps {
  table: Table | null;
  allTables: Table[];
  onSave: (table: Table) => void;
  onClose: () => void;
}

export function TableEditPanel({ table, allTables, onSave, onClose }: TableEditPanelProps) {
  const dragControls = useDragControls();
  const { size, isResizing, setIsResizing, panelRef } = usePanelResize();
  const [isReady, setIsReady] = useState(false);

  // Delay heavy rendering until animation finishes (makes opening feel instant)
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const {
    editedTable,
    errors,
    editorMode,
    sqlCode,
    sqlError,
    handleModeChange,
    handleSqlChange,
    handleTableNameChange,
    handleColumnChange,
    handleReferenceChange,
    addColumn,
    removeColumn,
    moveColumn,
    handleSave,
  } = useTableEditor(table, onSave, onClose);

  // Get available reference tables (all except current)
  const refTables = useMemo(() => {
    return editedTable ? allTables.filter(t => t.name !== editedTable.name) : [];
  }, [allTables, editedTable?.name]);

  if (!editedTable) return null;

  return (
    <motion.div
      ref={panelRef}
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      style={{ width: size.width, height: size.height }}
      className="absolute top-[10%] left-[50%] -translate-x-1/2 z-50 
             bg-card border border-border/50 
             shadow-2xl rounded-xl flex flex-col overflow-hidden
             ring-1 ring-black/5 dark:ring-white/10"
    >
      {/* Header / Drag Handle */}
      <div
        className="flex items-center justify-between px-3 py-2 
               bg-muted cursor-grab active:cursor-grabbing 
               border-b border-border/40 select-none"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 opacity-40" />
          <span className="text-xs font-medium text-muted-foreground">
            Edit Table
          </span>
          <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">
            {editedTable.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={editorMode} onValueChange={(v) => handleModeChange(v as EditorMode)}>
            <TabsList className="h-7 bg-background">
              <TabsTrigger value="visual" className="text-xs gap-1 px-2.5 h-6">
                <LayoutGrid className="w-3 h-3" /> Visual
              </TabsTrigger>
              <TabsTrigger value="sql" className="text-xs gap-1 px-2.5 h-6">
                <Code className="w-3 h-3" /> SQL
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost" size="icon"
            className="h-6 w-6 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="px-3 sm:px-4 py-2 border-b bg-muted">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {editorMode === 'visual' ? (
            <div className="flex items-center gap-2 w-full">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Table Name:</label>
              <Input
                value={editedTable.name}
                onChange={(e) => handleTableNameChange(e.target.value)}
                className="flex-1 h-7 text-sm font-mono"
                placeholder="table_name"
              />
            </div>
          ) : null}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 bg-background">
        {!isReady ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground h-40">
            <Loader2 className="w-6 h-6 animate-spin mb-2 opacity-50" />
            <p className="text-xs opacity-70">Loading editor...</p>
          </div>
        ) : editorMode === 'visual' ? (
          <VisualColumnEditor
            editedTable={editedTable}
            refTables={refTables}
            errors={errors}
            handleColumnChange={handleColumnChange}
            handleReferenceChange={handleReferenceChange}
            addColumn={addColumn}
            removeColumn={removeColumn}
            moveColumn={moveColumn}
          />
        ) : (
          /* SQL Editor Mode */
          <div className="p-4 space-y-3">
            <textarea
              value={sqlCode}
              onChange={(e) => handleSqlChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className={cn(
                "w-full h-80 p-3 font-mono font-normal text-sm bg-muted text-foreground rounded-lg border resize-none",
                "focus:outline-none focus:ring-2 focus:ring-primary",
                sqlError && "border-destructive focus:ring-destructive"
              )}
              spellCheck={false}
              placeholder="CREATE TABLE table_name (..."
            />
            {sqlError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{sqlError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="px-3 py-2.5 border-t flex items-center justify-between bg-card">
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground mr-auto">
          <Key className="w-3 h-3 text-amber-500" /> Primary Key
          <Link className="w-3 h-3 text-indigo-500 ml-2" /> Foreign Key
          <Sparkles className="w-3 h-3 text-emerald-500 ml-2" /> Unique
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none h-8 text-xs">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 sm:flex-none h-8 text-xs">
            <Save className="w-3.5 h-3.5 mr-1" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize 
               opacity-0 hover:opacity-100 transition-opacity z-10 
               flex items-center justify-center"
        onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); }}
      >
        <div className="w-2 h-2 border-r-2 border-b-2 border-primary/50 rounded-br-sm" />
      </div>
    </motion.div>
  );
}
