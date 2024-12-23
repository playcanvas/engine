/**
 * The engine version number. This is in semantic versioning format (MAJOR.MINOR.PATCH).
 */
const version = '$_CURRENT_SDK_VERSION';

/**
 * The engine revision number. This is the Git hash of the last commit made to the branch
 * from which the engine was built.
 */
const revision = '$_CURRENT_SDK_REVISION';

/**
 * Merge the contents of two objects into a single object.
 *
 * @param {object} target - The target object of the merge.
 * @param {object} ex - The object that is merged with target.
 * @returns {object} The target object.
 * @example
 * const A = {
 *     a: function () {
 *         console.log(this.a);
 *     }
 * };
 * const B = {
 *     b: function () {
 *         console.log(this.b);
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
        const copy = ex[prop];

        if (Array.isArray(copy)) {
            target[prop] = extend([], copy);
        } else if (copy && typeof copy === 'object') {
            target[prop] = extend({}, copy);
        } else {
            target[prop] = copy;
        }
    }

    return target;
}

export { extend, revision, version };
