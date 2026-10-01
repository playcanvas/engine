import { exampleMetaData } from '../../cache/metadata.mjs';

/**
 * @param {string} a - First name.
 * @param {string} b - Second name.
 * @returns {number} Sort order.
 */
export const byName = (a, b) => (a > b ? 1 : -1);

/**
 * The categories as listed by the sidebar. Hidden examples are always built and
 * reachable via URL, but are only listed during development (`npm run develop`),
 * not in production builds (`npm run build`).
 *
 * @returns {Record<string, { examples: Record<string, string> }>} - The category files.
 */
export function getCategories() {
    /** @type {Record<string, { examples: Record<string, string> }>} */
    const categories = {};
    for (let i = 0; i < exampleMetaData.length; i++) {
        const { categoryKebab, exampleNameKebab, hidden } = exampleMetaData[i];

        if (hidden && process.env.NODE_ENV !== 'development') {
            continue;
        }

        if (!categories[categoryKebab]) {
            categories[categoryKebab] = { examples: {} };
        }

        categories[categoryKebab].examples[exampleNameKebab] = exampleNameKebab;
    }
    return categories;
}

/**
 * The first example of a category as the sidebar orders them, used to resolve a
 * bare `#/<category>` URL to a concrete example.
 *
 * @param {string} category - Category name.
 * @returns {string | null} Example name, or null if the category is unknown.
 */
export function getFirstExample(category) {
    const examples = getCategories()[category]?.examples;
    if (!examples) {
        return null;
    }
    return Object.keys(examples).sort(byName)[0] ?? null;
}
