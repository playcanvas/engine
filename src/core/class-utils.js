/**
 * Checks if a class contains a method either itself or in it's inheritance chain
 *
 * @param {Function} testClass - The class to check
 * @param {string} method - The name of the method to check
 * @returns {boolean} if a valid class and contains the method in it's inheritance chain
 * @ignore
 */
export const classHasMethod = (testClass, method) => {
    return typeof testClass === 'function' &&
        typeof testClass.prototype === 'object' &&
        method in testClass.prototype;
};
