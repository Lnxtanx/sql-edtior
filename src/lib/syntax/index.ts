/**
 * Syntax Highlighting Module
 * 
 * Provides token-based SQL syntax coloring using the existing PostgreSQL tokenizer.
 */

export {
    colorizeSQL,
    colorizeToHTML,
    type ColorizedSpan,
    type ColorizedLine,
    type ColorizeResult,
} from './SyntaxColorizer';

export {
    getTokenClass,
    TOKEN_CLASSES,
    DATA_TYPE_KEYWORDS,
    DATA_TYPE_CLASS,
    EDITOR_CONTAINER_CLASS,
    LINE_NUMBER_CLASS,
} from './token-classes';
