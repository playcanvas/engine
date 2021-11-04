/**
 * @private
 * @class
 * @name AnimBinder
 * @classdesc This interface is used by {@link AnimEvaluator} to resolve unique animation target path strings
 * into instances of {@link AnimTarget}.
 */
class AnimBinder {
    // join a list of path segments into a path string using the full stop character. If another character is supplied,
    // it will join using that character instead
    static joinPath(pathSegments, character) {
        character = character || '.';
        const escape = function (string) {
            return string.replace(/\\/g, '\\\\').replace(new RegExp('\\' + character, 'g'), '\\' + character);
        };
        return pathSegments.map(escape).join(character);
    }

    // split a path string into its segments and resolve character escaping
    static splitPath(path, character) {
        character = character || '.';
        const result = [];
        let curr = "";
        let i = 0;
        while (i < path.length) {
            let c = path[i++];

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
     * @static
     * @function
     * @name AnimBinder#encode
     * @description Converts a locator array into its string version.
     * @param {string|Array} entityPath - The entity location in the scene defined as an array or string path.
     * @param {string} component - The component of the entity the property is located under.
     * @param {string|Array} propertyPath - The property location in the entity defined as an array or string path.
     * @returns {string} The locator encoded as a string.
     * @example
     * // returns 'spotLight/light/color.r'
     * encode(['spotLight'], 'light', ['color', 'r']);
     */
    static encode(entityPath, component, propertyPath) {
        return `${
            Array.isArray(entityPath) ? entityPath.join('/') : entityPath
        }/${component}/${
            Array.isArray(propertyPath) ? propertyPath.join('/') : propertyPath
        }`;
    }

    /**
     * @private
     * @function
     * @name AnimBinder#resolve
     * @description Resolve the provided target path and return an instance of {@link AnimTarget} which
     * will handle setting the value, or return null if no such target exists.
     * @param {string} path - The animation curve path to resolve.
     * @returns {AnimTarget|null} - Returns the target instance on success and null otherwise.
     */
    resolve(path) {
        return null;
    }

    /**
     * @private
     * @function
     * @name AnimBinder#unresolve
     * @description Called when the {@link AnimEvaluator} no longer has a curve driving the given key.
     * @param {string} path - The animation curve path which is no longer driven.
     */
    unresolve(path) {

    }

    /**
     * @private
     * @function
     * @name AnimBinder#update
     * @description Called by {@link AnimEvaluator} once a frame after animation updates are done.
     * @param {number} deltaTime - Amount of time that passed in the current update.
     */
    update(deltaTime) {

    }
}

export { AnimBinder };
