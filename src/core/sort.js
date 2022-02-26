/**
 * 
 * @param {{priority: number}} a 
 * @param {{priority: number}} b 
 * @returns 
 */

export const cmpPriority  = (a, b) => a.priority - b.priority;

/**
 * 
 * @param {Array<{priority: number}>} arr 
 * @returns 
 */

export const sortPriority = arr => arr.sort(cmpPriority);
