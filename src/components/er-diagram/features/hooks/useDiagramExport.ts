import { useCallback } from 'react';
import { toPng, toSvg } from 'html-to-image';
import { ParsedSchema } from '@/lib/sql-parser';
import {
    generatePrismaSchema,
    generateDrizzleSchema,
    generateDBML,
    generateMarkdownDocs,
    generateTypeScriptTypes,
} from '@/lib/schema-utils/schema-generators';

export function useDiagramExport(schema: ParsedSchema | null | undefined, reactFlowWrapper: React.RefObject<HTMLDivElement>) {
    // Export functions
    const exportImage = useCallback(async (format: 'png' | 'svg') => {
        if (!reactFlowWrapper.current) return;

        const flowElement = reactFlowWrapper.current.querySelector('.react-flow') as HTMLElement;
        if (!flowElement) return;

        try {
            const exportFn = format === 'png' ? toPng : toSvg;
            const dataUrl = await exportFn(flowElement, {
                backgroundColor: '#ffffff',
                quality: 1,
                pixelRatio: 2,
            });

            const link = document.createElement('a');
            link.download = `er-diagram-${Date.now()}.${format}`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Export failed:', error);
        }
    }, []);

    // Export schema to different formats
    const exportSchema = useCallback((format: 'prisma' | 'drizzle' | 'dbml' | 'markdown' | 'typescript') => {
        if (!schema) return;

        let content = '';
        let filename = '';
        let mimeType = 'text/plain';

        switch (format) {
            case 'prisma':
                content = generatePrismaSchema(schema);
                filename = 'schema.prisma';
                break;
            case 'drizzle':
                content = generateDrizzleSchema(schema);
                filename = 'schema.ts';
                mimeType = 'text/typescript';
                break;
            case 'dbml':
                content = generateDBML(schema);
                filename = 'schema.dbml';
                break;
            case 'markdown':
                content = generateMarkdownDocs(schema);
                filename = 'SCHEMA.md';
                mimeType = 'text/markdown';
                break;
            case 'typescript':
                content = generateTypeScriptTypes(schema);
                filename = 'types.ts';
                mimeType = 'text/typescript';
                break;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }, [schema]);

    return { exportImage, exportSchema };
}
