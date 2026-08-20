/**
 * The engine version number. This is in semantic versioning format (MAJOR.MINOR.PATCH).
 */
const version = '$_CURRENT_SDK_VERSION';

/**
 * The engine revision number. This is the Git hash of the last commit made to the branch
 * from which the engine was built.
 */
const revision = '$_CURRENT_SDK_REVISION';

import { Debug } from './debug.js';

/**
 * Merge the contents of two objects into a single object.
 *
 * @param {object} target - The target object of the merge.
 * @param {object} ex - The object to be merged into the target.
 * @returns {object} The target object.
 * @example
 * var A = {
 *     a: function () {
 *         console.log('a');
 *     }
 * };
 * var B = {
 *     b: function () {
 *         console.log('b');
 *     }
 * };
 *
 * extend(A, B);
 * A.a();
 * // logs "a"
 * A.b();
 * // logs "b"
 * @ignore
 */
function extend(target, ex) {
    for (const prop in ex) {
        if (!Object.prototype.hasOwnProperty.call(ex, prop)) {
            continue;
        }

        const isForbidden = prop === '__proto__' || prop === 'constructor' || prop === 'prototype';
        if (isForbidden) {
            Debug.warnOnce(`Ignoring forbidden property: ${prop}`);
            continue;
        }

        const copy = ex[prop];

        if (Array.isArray(copy)) {
            if (!Array.isArray(target[prop])) {
                target[prop] = [];
            }
            extend(target[prop], copy);
        } else if (copy && typeof copy === 'object') {
            if (!target[prop] || typeof target[prop] !== 'object') {
                target[prop] = {};
            }
            extend(target[prop], copy);
        } else {
            target[prop] = copy;
        }
    }

    return target;
}


export { extend, revision, version };
