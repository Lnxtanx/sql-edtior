import { ParsedSchema, Relationship } from '../../sql-parser/types/core-types';
import { RelationshipBuilder } from './RelationshipBuilder';

/**
 * extracts Foreign Key and Partition relationships already found by the parser
 */
export class ForeignKeyBuilder implements RelationshipBuilder {
    build(schema: ParsedSchema): Relationship[] {
        // The SQL parser already does the heavy lifting for FKs and Partitions
        // We just need to filter them out of the generic relationships list
        return schema.relationships.filter(rel =>
            rel.type === 'FOREIGN_KEY' ||
            rel.type === 'PARTITION_CHILD'
        ).map(rel => ({
            ...rel,
            sourceType: 'EXPLICIT_FK',
            confidence: 1.0
        }));
    }
}
