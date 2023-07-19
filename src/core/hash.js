/**
 * Calculates simple hash value of a string. Designed for performance, not perfect.
 *
 * @param {string} str - String.
 * @returns {number} Hash value.
 * @ignore
 */
function hashCode(str) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        // Convert to 32bit integer
        hash |= 0;
    }
    return hash;
}

/**
 * Calculates simple hash value of an array of numbers. Designed for performance, but provides good
 * distribution with small number of collisions.
 *.
 * @param {Uint32Array} typedArray - Array of numbers to hash.
 * @returns {number} Hash value.
 */
function fnv1aHashUint32Array(typedArray) {
    const prime = 16777619;
    let hash = 2166136261;

    for (let i = 0; i < typedArray.length; i++) {
        hash ^= typedArray[i];
        hash *= prime;
    }
    return hash >>> 0; // Ensure non-negative integer
}

export { hashCode, fnv1aHashUint32Array };
