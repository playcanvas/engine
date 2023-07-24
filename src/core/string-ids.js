/**
 * A cache for assigning unique numerical ids to strings.
 *
 * @ignore
 */
class StringIds {
    /** @type {Map<string, number>} */
    map = new Map();

    /** @type {number} */
    id = 0;

    /**
     * Get the id for the given name. If the name has not been seen before, it will be assigned a new
     * id.
     *
     * @param {string} name - The name to get the id for.
     * @returns {number} The id for the given name.
     */
    get(name) {
        let value = this.map.get(name);
        if (value === undefined) {
            value = this.id++;
            this.map.set(name, value);
        }

        return value;
    }
}

export { StringIds };
