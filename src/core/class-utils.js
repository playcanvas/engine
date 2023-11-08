/**
 * Checks if a class contains a method either itself or in it's inheritance chain
 *
 * @param {Function} Class - The class to check
 * @param {string} method - The name of the method to check
 * @returns {boolean} if a valid class and contains the method in it's inheritance chain
 */
export const classHasMethod = (Class, method) => {
    return typeof Class === 'function' &&
        typeof Class.prototype === 'object' &&
        method in Class.prototype;
};
