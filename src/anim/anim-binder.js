/**
 * @private
 * @class
 * @name pc.AnimBinder
 * @classdesc This interface is used by {@link pc.AnimEvaluator} to resolve unique animation target path strings
 * into instances of {@link pc.AnimTarget}.
 */
class AnimBinder {
    constructor() {}

    // join a list of path segments into a path string using the full stop character. If another character is supplied,
    // it will join using that character instead
    static joinPath(pathSegments, character) {
        character = character || '.';
        var escape = function (string) {
            return string.replace(/\\/g, '\\\\').replace(new RegExp('\\' + character, 'g'), '\\' + character);
        };
        return pathSegments.map(escape).join(character);
    }

    // split a path string into its segments and resolve character escaping
    static splitPath(path, character) {
        character = character || '.';
        var result = [];
        var curr = "";
        var i = 0;
        while (i < path.length) {
            var c = path[i++];

            if (c === '\\' && i < path.length) {
                c = path[i++];
                if (c === '\\' || c === character) {
                    curr += c;
                } else {
                    curr += '\\' + c;
                }
            } else if (c === character) {
                result.push(curr);
                curr = '';
            } else {
                curr += c;
            }
        }
        if (curr.length > 0) {
            result.push(curr);
        }
        return result;
    }

    /**
     * @private
     * @function
     * @name pc.AnimBinder#resolve
     * @description Resolve the provided target path and return an instance of {@link pc.AnimTarget} which
     * will handle setting the value, or return null if no such target exists.
     * @param {string} path - the animation curve path to resolve.
     * @returns {pc.AnimTarget|null} - returns the target instance on success and null otherwise.
     */
    resolve(path) {
        return null;
    }

    /**
     * @private
     * @function
     * @name pc.AnimBinder#unresolve
     * @description Called when the {@link AnimEvaluator} no longer has a curve driving the given key.
     * @param {string} path - the animation curve path which is no longer driven.
     */
    unresolve(path) {

    }

    /**
     * @private
     * @function
     * @name pc.AnimBinder#update
     * @description Called by {@link pc.AnimEvaluator} once a frame after animation updates are done.
     * @param {number} deltaTime - amount of time that passed in the current update.
     */
    update(deltaTime) {

    }
}

export { AnimBinder };
