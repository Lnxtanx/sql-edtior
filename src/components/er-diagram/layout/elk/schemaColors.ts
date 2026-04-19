import { useTheme } from 'next-themes';

export interface SchemaTheme {
    border: string;
    header: string; // CSS background value (linear-gradient)
    accent: string; // Background for PK/FK rows
    foreground: string; // Color for PK/FK text and icons
}

// Map explicit schemas to a distinct Hue (0-360) and optional Saturation (0-100)
const EXPLICIT_HUES: Record<string, { h: number; s: number }> = {
    public: { h: 238, s: 80 },     // Indigo
    auth: { h: 270, s: 80 },       // Purple
    storage: { h: 140, s: 75 },    // Emerald
    api: { h: 24, s: 90 },         // Orange
    admin: { h: 0, s: 80 },        // Red
    billing: { h: 45, s: 90 },     // Yellow
    analytics: { h: 190, s: 90 },  // Cyan
    core: { h: 215, s: 25 },       // Slate
    saas: { h: 290, s: 80 },       // Fuchsia
    payment: { h: 170, s: 80 },    // Teal
    ecommerce: { h: 40, s: 90 },   // Amber
    audit_logs: { h: 215, s: 20 }, // Slate
};

function stringHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

/**
 * Returns a theme-aware border and header gradient for a given schema.
 * Uses next-themes to detect light/dark mode.
 */
export function useSchemaColor(schema?: string): SchemaTheme {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark' || 
                   resolvedTheme === 'modern-gray' || 
                   resolvedTheme === 'dark-black' || 
                   resolvedTheme === 'blue-gray';

    const lower = (schema || 'public').toLowerCase();

    // Determine Hue and Saturation
    let h: number;
    let s: number;

    if (EXPLICIT_HUES[lower]) {
        h = EXPLICIT_HUES[lower].h;
        s = EXPLICIT_HUES[lower].s;
    } else {
        h = stringHash(lower) % 360;
        s = 75; // Default saturation for dynamic schemas
    }

    if (isDark) {
        // Dark mode: saturated but darker borders, very dark rich headers
        return {
            border: `hsl(${h}, ${s - 10}%, 45%)`,
            header: `linear-gradient(to right, hsl(${h}, ${s - 20}%, 30%), hsl(${h}, ${s - 10}%, 20%))`,
            accent: `hsl(${h}, ${Math.max(10, s - 40)}%, 12%)`,
            foreground: `hsl(${h}, ${s - 10}%, 70%)`,
        };
    } else {
        // Light mode: Vibrant borders, normal gradients
        return {
            border: `hsl(${h}, ${s}%, 55%)`,
            header: `linear-gradient(to right, hsl(${h}, ${s}%, 55%), hsl(${h}, ${s + 10}%, 45%))`,
            accent: `hsl(${h}, ${s}%, 96%)`,
            foreground: `hsl(${h}, ${s + 10}%, 35%)`,
        };
    }
}

/**
 * Legacy getter for non-React contexts if needed. 
 * Defaults to light mode colors.
 */
export function getSchemaColor(schema?: string): SchemaTheme {
    const lower = (schema || 'public').toLowerCase();

    let h: number;
    let s: number;

    if (EXPLICIT_HUES[lower]) {
        h = EXPLICIT_HUES[lower].h;
        s = EXPLICIT_HUES[lower].s;
    } else {
        h = stringHash(lower) % 360;
        s = 75;
    }

    return {
        border: `hsl(${h}, ${s}%, 55%)`,
        header: `linear-gradient(to right, hsl(${h}, ${s}%, 55%), hsl(${h}, ${s + 10}%, 45%))`,
        accent: `hsl(${h}, ${s}%, 96%)`,
        foreground: `hsl(${h}, ${s + 10}%, 35%)`,
    };
}

