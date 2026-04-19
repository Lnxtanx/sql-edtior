// =============================================================================
// Export Button - CSV download trigger
// =============================================================================

import { Download, Loader2, FileJson, FileSpreadsheet, FileText, Database } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { downloadTableData, downloadAllTablesData } from '@/lib/api/data-explorer';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface ExportButtonProps {
  connectionId: string | null;
  tableName: string;
  schemaName: string;
  maxRows?: number;
}

export function ExportButton({
  connectionId,
  tableName,
  schemaName,
  maxRows = 10000,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: string) => {
    if (!connectionId || !tableName) return;

    setIsExporting(true);
    try {
      downloadTableData(connectionId, tableName, schemaName, maxRows, format);
    } finally {
      // Small delay to show feedback
      setTimeout(() => setIsExporting(false), 500);
    }
  };

  const handleExportAll = async (format: string) => {
    if (!connectionId) return;

    setIsExporting(true);
    toast.info(`Exporting schema '${schemaName}'...`, {
      description: `Preparing ZIP archive of ${format.toUpperCase()} files. This may take a moment depending on the database size.`,
      duration: 5000,
    });
    
    try {
      // Small timeout to allow toast to render and state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      downloadAllTablesData(connectionId, schemaName, format);
    } catch (error) {
      toast.error('Failed to initiate export');
      console.error(error);
    } finally {
      setTimeout(() => setIsExporting(false), 2000);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          className="gap-1"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {!connectionId ? (
          <DropdownMenuItem disabled className="text-muted-foreground justify-center">
            Select a connection to export
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuLabel>Current Table</DropdownMenuLabel>
            {!tableName ? (
              <DropdownMenuItem disabled className="text-muted-foreground justify-center">
                Select a table to export rows
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>Export as CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')} className="cursor-pointer gap-2">
                  <FileJson className="w-4 h-4 text-muted-foreground" />
                  <span>Export as JSON</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('ndjson')} className="cursor-pointer gap-2">
                  <FileJson className="w-4 h-4 text-muted-foreground" />
                  <span>Export as NDJSON</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                  <span>Export as Excel</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('sql')} className="cursor-pointer gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <span>Export as SQL</span>
                </DropdownMenuItem>
              </>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Database (Schema Export)</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleExportAll('csv')} className="cursor-pointer gap-2 font-medium text-blue-600 dark:text-blue-400 focus:text-blue-700 dark:focus:text-blue-300">
              <Download className="w-4 h-4" />
              <span>Export Schema as CSV ZIP</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportAll('json')} className="cursor-pointer gap-2 font-medium text-blue-600 dark:text-blue-400 focus:text-blue-700 dark:focus:text-blue-300">
              <Download className="w-4 h-4" />
              <span>Export Schema as JSON ZIP</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportAll('ndjson')} className="cursor-pointer gap-2 font-medium text-blue-600 dark:text-blue-400 focus:text-blue-700 dark:focus:text-blue-300">
              <Download className="w-4 h-4" />
              <span>Export Schema as NDJSON ZIP</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportAll('excel')} className="cursor-pointer gap-2 font-medium text-blue-600 dark:text-blue-400 focus:text-blue-700 dark:focus:text-blue-300">
              <Download className="w-4 h-4" />
              <span>Export Schema as Excel ZIP</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportAll('sql')} className="cursor-pointer gap-2 font-medium text-blue-600 dark:text-blue-400 focus:text-blue-700 dark:focus:text-blue-300">
              <Download className="w-4 h-4" />
              <span>Export Schema as SQL ZIP</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
