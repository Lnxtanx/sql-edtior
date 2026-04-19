/**
 * Attachment Preview List
 * 
 * Displays a grid of file attachment previews with remove buttons.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { X, FileIcon } from 'lucide-react';

interface Attachment {
    file: File;
    id: string;
    preview?: string;
    content?: string;
}

interface AttachmentPreviewListProps {
    attachments: Attachment[];
    onRemove: (id: string) => void;
    onClick: (attachment: Attachment) => void;
}

export function AttachmentPreviewList({
    attachments,
    onRemove,
    onClick
}: AttachmentPreviewListProps) {
    if (attachments.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex flex-wrap gap-2 mb-2 px-1"
            >
                {attachments.map((att) => (
                    <div key={att.id} className="relative group">
                        <div
                            onClick={() => onClick(att)}
                            className="w-16 h-16 rounded-lg border bg-muted overflow-hidden flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                        >
                            {att.preview ? (
                                <img src={att.preview} alt="preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center gap-1">
                                    <FileIcon className="w-6 h-6 text-muted-foreground" />
                                    <span className="text-[8px] text-muted-foreground truncate w-12 text-center text-wrap px-1">
                                        {att.file.name}
                                    </span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(att.id);
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </motion.div>
        </AnimatePresence>
    );
}
