import { ParsedSchema, Relationship } from '../../sql-parser/types/core-types';

/**
 * Interface for building relationships from a parsed schema
 */
export interface RelationshipBuilder {
    /**
     * Build relationships from the schema
     */
    build(schema: ParsedSchema): Relationship[];
}
