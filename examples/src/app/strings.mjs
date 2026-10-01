/**
 * @param {string} string - The source string.
 * @returns {string} - The capitalized string.
 *
 * @example
 * capitalizeFirstLetter("test") // Outputs 'Test'
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * @param {string} str - The string.
 * @returns {string} - The kebab-case-format
 *
 * @example
 * toKebabCase('BlendTrees1D'); // Outputs: 'blend-trees-1d'
 * toKebabCase('LightsBakedAO'); // Outputs 'lights-baked-a-o'
 */
function toKebabCase(str) {
    return str
    .replace(/([A-Z])([A-Z])/g, '$1-$2') // case for "...AO" -> '...-a-o'
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z])([a-z])/g, '$1-$2$3')
    .toLowerCase()
    .replace(/(\d)d/g, '-$1d')
    .replace(/--/g, '-');
}

/**
 * @param {string} str - String with leading spaces.
 * @returns {number} Number of spaces.
 * @example
 * countLeadingSpaces('  Hello!'); // Result: 2
 */
function countLeadingSpaces(str) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === ' ') {
            count++;
        } else {
            break;
        }
    }
    return count;
}

/**
 * @param {string} code - Code with redundant spaces over many lines.
 * @returns {string} Same code, but removed redundant spaces.
 */
function removeRedundantSpaces(code) {
    const lines = code
    .split('\n')
    .slice(0, -1) // ignore last line - it's just used for nice template-string indentation
    .filter(_ => Boolean(_.trim())) // ignore spaces-only lines
    .map(countLeadingSpaces);
    if (!lines.length) {
        return code;
    }
    const n = Math.min(...lines);
    const removeSpacesRegExp = new RegExp(' '.repeat(n), 'g');
    const prettyCode = `${code.replace(removeSpacesRegExp, '').trim()}\n`;
    return prettyCode;
}

/**
 * Words shown in upper case.
 */
const ACRONYMS = new Set([
    'ao', 'ar', 'esm', 'gl', 'glb', 'hdr', 'html', 'lod', 'lut', 'msaa', 'obj', 'sh', 'spz', 'taa', 'ui',
    'usdz', 'uv', 'vat', 'vr', 'xr'
]);

/**
 * Words with a fixed spelling.
 *
 * @type {Record<string, string>}
 */
const SPELLINGS = {
    gltf: 'glTF',
    gsplat: 'GSplat'
};

/**
 * Words kept lower case unless they start the name.
 */
const MINOR_WORDS = new Set(['and', 'of', 'on', 'to', 'without']);

/**
 * @param {string} kebab - A kebab-case name.
 * @returns {string} The name in title case, with acronyms kept in upper case.
 * @example
 * toDisplayName('lights-baked-a-o'); // Outputs: 'Lights Baked AO'
 * toDisplayName('blend-trees-1d'); // Outputs: 'Blend Trees 1D'
 */
function toDisplayName(kebab) {
    // toKebabCase splits acronyms into single letters ('AO' -> 'a-o'), so join them back
    const words = kebab.replace(/\b([a-z])-(?=[a-z]\b)/g, '$1').split('-');
    return words.map((word, i) => {
        if (SPELLINGS[word]) {
            return SPELLINGS[word];
        }
        if (ACRONYMS.has(word) || /\d/.test(word)) {
            return word.toUpperCase();
        }
        return i > 0 && MINOR_WORDS.has(word) ? word : capitalizeFirstLetter(word);
    }).join(' ');
}

export { capitalizeFirstLetter, toKebabCase, removeRedundantSpaces, toDisplayName };
