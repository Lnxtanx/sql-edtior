/**
 * elk/heightCalculators.ts
 * Node height estimators — map data objects to pixel heights for ELK sizing.
 */
import { Table } from '@/lib/sql-parser';
import {
    NODE_HEIGHT_BASE,
    NODE_HEIGHT_PER_COLUMN,
    VIEW_NODE_HEIGHT_BASE,
    VIEW_COL_HEIGHT,
    ENUM_HEIGHT_BASE,
    ENUM_VAL_HEIGHT,
    POLICY_HEIGHT_BASE,
    POLICY_HEIGHT_PER_ROLE,
} from './constants';

export function computeTableHeight(table: Table, viewMode: 'ALL' | 'KEYS' | 'TITLE'): number {
    const visibleColumns =
        viewMode === 'TITLE' ? [] :
            viewMode === 'KEYS' ? table.columns.filter(c => c.isPrimaryKey || c.isForeignKey) :
                table.columns;
    return NODE_HEIGHT_BASE + visibleColumns.length * NODE_HEIGHT_PER_COLUMN;
}

export function computeViewHeight(colCount: number): number {
    return VIEW_NODE_HEIGHT_BASE + Math.min(colCount, 5) * VIEW_COL_HEIGHT;
}

export function computeEnumHeight(valuesLength: number): number {
    // Roughly estimate wrapping of enum values in the flex container
    const rows = Math.ceil(valuesLength / 3);
    return ENUM_HEIGHT_BASE + (rows * ENUM_VAL_HEIGHT);
}

export function computePolicyHeight(policy: any): number {
    const roleRows = Math.ceil((policy.roles?.length || 0) / 3);
    const usingRows = policy.usingExpression ? 1 : 0;
    const checkRows = policy.checkExpression ? 1 : 0;
    return POLICY_HEIGHT_BASE + (roleRows * POLICY_HEIGHT_PER_ROLE) + (usingRows * 20) + (checkRows * 20);
}
