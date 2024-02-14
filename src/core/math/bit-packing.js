/**
 * BitPacking API - functionality for operating on values stored as bits in a number.
 *
 * @namespace
 * @ignore
 */
const BitPacking = {

    /**
     * Sets a value to specified bits of a number.
     *
     * @param {number} storage - Number to store the bits into.
     * @param {number} value - Value to store.
     * @param {number} shift - Number of bits to shift the value.
     * @param {number} [mask] - Mask for the value to limit the number of storage bits. Defaults to 1.
     * @returns {number} Returns the storage updated with the value.
     */
    set(storage, value, shift, mask = 1) {
        // clear the space
        const data = storage & ~(mask << shift);

        // set the bits
        return data | (value << shift);
    },

    /**
     * Gets the value of specified bits from a number.
     *
     * @param {number} storage - Number to extract the bits from.
     * @param {number} shift - Number of bits to shift the mask.
     * @param {number} [mask] - Mask for the value to limit the number of storage bits. Defaults to 1.
     * @returns {number} Returns the extracted value.
     */
    get(storage, shift, mask = 1) {
        return (storage >> shift) & mask;
    },

    /**
     * Tests if all specified bits are set.
     *
     * @param {number} storage - Number to test.
     * @param {number} shift - Number of bits to shift the mask.
     * @param {number} [mask] - Mask to limit the number of storage bits. Defaults to 1.
     * @returns {boolean} Returns true if all bits in the mask are set in the storage.
     */
    all(storage, shift, mask = 1) {
        const shifted = mask << shift;
        return (storage & shifted) === shifted;
    },

    /**
     * Tests if any specified bits are set.
     *
     * @param {number} storage - Number to test.
     * @param {number} shift - Number of bits to shift the mask.
     * @param {number} [mask] - Mask to limit the number of storage bits. Defaults to 1.
     * @returns {boolean} Returns true if any bits in the mask are set in the storage.
     */
    any(storage, shift, mask = 1) {
        return (storage & (mask << shift)) !== 0;
    }
};

export { BitPacking };
