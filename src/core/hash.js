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
 * Calculates simple 32bit hash value of an array of 32bit integer numbers. Designed for
 * performance, but provides good distribution with small number of collisions. Based on
 * FNV-1a non-cryptographic hash function.
 *.
 * @param {number[]|Uint32Array} array - Array of 32bit integer numbers to hash.
 * @returns {number} 32bit unsigned integer hash value.
 * @ignore
 */
function hash32Fnv1a(array) {
    const prime = 16777619;
    let hash = 2166136261;

    for (let i = 0; i < array.length; i++) {
        hash ^= array[i];
        hash *= prime;
    }
    return hash >>> 0; // Ensure non-negative integer
}

export { hashCode, hash32Fnv1a };
