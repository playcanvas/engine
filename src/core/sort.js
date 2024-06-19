/**
 * @typedef {import('../framework/components/component').Component} Component
 */

/**
 * @param {{priority: number}} a - First object with priority property.
 * @param {{priority: number}} b - Second object with priority property.
 * @returns {number} A number indicating the relative position.
 * @ignore
 */
const cmpPriority = (a, b) => a.priority - b.priority;


/**
 * @param {Component} a - First object with `order` property.
 * @param {Component} b - Second object with `order` property.
 * @returns {number} A number indicating the relative position.
 * @ignore
 */
const cmpStaticOrder = (a, b) => a.constructor.order - b.constructor.order;

/**
 * @param {Array<{priority: number}>} arr - Array to be sorted in place where each element contains
 * an object with at least a priority property.
 * @returns {Array<{priority: number}>} In place sorted array.
 * @ignore
 */
export const sortPriority = arr => arr.sort(cmpPriority);

/**
 * @param {Array<Component>} arr - Array to be sorted in place where each element contains
 * an object with a static `order` property.
 * @returns {Array<Component>} In place sorted array.
 * @ignore
 */
export const sortStaticOrder = arr => arr.sort(cmpStaticOrder);
