import { FileText, UploadCloud, Search, HardDrive, MoreHorizontal, FileSpreadsheet, FileCode, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AIChatLibrary() {
    return (
        <main className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            {/* Header */}
            <div className="h-14 flex items-center px-6 shrink-0 border-b border-border/40">
                <h2 className="text-sm font-semibold text-foreground">Library</h2>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-8 py-8">
                <div className="max-w-5xl mx-auto flex flex-col gap-8">
                    {/* Top Action Bar */}
                    <div className="flex items-center justify-between">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search your files..."
                                className="pl-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-colors"
                            />
                        </div>
                        <Button className="gap-2">
                            <UploadCloud className="h-4 w-4" />
                            Upload Document
                        </Button>
                    </div>

                    {/* Quick Access Documents */}
                    <div>
                        <h3 className="text-lg font-semibold text-foreground mb-4">Recent Documents</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { name: "company_schema.sql", type: "sql", size: "14 KB" },
                                { name: "sales_data_2025.csv", type: "csv", size: "2.4 MB" },
                                { name: "api_requirements.pdf", type: "pdf", size: "840 KB" },
                                { name: "user_metrics.json", type: "json", size: "45 KB" }
                            ].map((doc, i) => (
                                <div key={i} className="group border border-border/60 bg-card rounded-xl p-4 hover:border-border hover:shadow-sm transition-all cursor-pointer flex flex-col gap-3">
                                    <div className="flex items-start justify-between">
                                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                            {doc.type === 'csv' ? <FileSpreadsheet className="w-5 h-5" /> :
                                                doc.type === 'sql' || doc.type === 'json' ? <FileCode className="w-5 h-5" /> :
                                                    <FileText className="w-5 h-5" />}
                                        </div>
                                        <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100 text-muted-foreground">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-sm text-foreground truncate" title={doc.name}>{doc.name}</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">{doc.size} • 2 days ago</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Created Assets / Data Sources */}
                    <div>
                        <h3 className="text-lg font-semibold text-foreground mb-4">Saved Connections</h3>
                        <div className="bg-card border border-border/60 rounded-xl overflow-hidden text-sm">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border/60 bg-muted/20">
                                        <th className="font-medium text-muted-foreground py-3 px-4">Name</th>
                                        <th className="font-medium text-muted-foreground py-3 px-4">Type</th>
                                        <th className="font-medium text-muted-foreground py-3 px-4">Last Sync</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { name: "Production DB", type: "PostgreSQL", lastSync: "10 mins ago" },
                                        { name: "Analytics Warehouse", type: "Snowflake", lastSync: "2 hours ago" },
                                        { name: "Staging Replica", type: "MySQL", lastSync: "1 day ago" }
                                    ].map((source, i) => (
                                        <tr key={i} className="border-b border-border/40 hover:bg-muted/10 last:border-0">
                                            <td className="py-3 px-4 font-medium flex items-center gap-2">
                                                <HardDrive className="w-4 h-4 text-muted-foreground" />
                                                {source.name}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">{source.type}</td>
                                            <td className="py-3 px-4 text-muted-foreground flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {source.lastSync}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
