import { EventHandler } from './event-handler.js';

/**
 * Set of tag names. Tags are automatically available on {@link Entity} and {@link Asset} as `tags`
 * field.
 *
 * @augments EventHandler
 */
class Tags extends EventHandler {
    /**
     * Fired for each individual tag that is added.
     *
     * @event
     * @example
     * tags.on('add', (tag, parent) => {
     *    console.log(`${tag} added to ${parent.name}`);
     * });
     */
    static EVENT_ADD = 'add';

    /**
     * Fired for each individual tag that is removed.
     *
     * @event
     * @example
     * tags.on('remove', (tag, parent) => {
     *   console.log(`${tag} removed from ${parent.name}`);
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * Fired when tags have been added or removed. It will fire once on bulk changes, while `add`
     * and `remove` will fire on each tag operation.
     *
     * @event
     * @example
     * tags.on('change', (parent) => {
     *    console.log(`Tags changed on ${parent.name}`);
     * });
     */
    static EVENT_CHANGE = 'change';

    /** @private */
    _index = {};

    /** @private */
    _list = [];

    /**
     * Create an instance of a Tags.
     *
     * @param {object} [parent] - Parent object who tags belong to.
     */
    constructor(parent) {
        super();

        this._parent = parent;
    }

    /**
     * Add a tag, duplicates are ignored. Can be array or comma separated arguments for multiple tags.
     *
     * @param {...*} name - Name of a tag, or array of tags.
     * @returns {boolean} True if any tag were added.
     * @example
     * tags.add('level-1');
     * @example
     * tags.add('ui', 'settings');
     * @example
     * tags.add(['level-2', 'mob']);
     */
    add() {
        let changed = false;
        const tags = this._processArguments(arguments, true);

        if (!tags.length)
            return changed;

        for (let i = 0; i < tags.length; i++) {
            if (this._index[tags[i]])
                continue;

            changed = true;

            this._index[tags[i]] = true;
            this._list.push(tags[i]);

            this.fire('add', tags[i], this._parent);
        }

        if (changed)
            this.fire('change', this._parent);

        return changed;
    }

    /**
     * Remove tag.
     *
     * @param {...*} name - Name of a tag or array of tags.
     * @returns {boolean} True if any tag were removed.
     * @example
     * tags.remove('level-1');
     * @example
     * tags.remove('ui', 'settings');
     * @example
     * tags.remove(['level-2', 'mob']);
     */
    remove() {
        let changed = false;

        if (!this._list.length)
            return changed;

        const tags = this._processArguments(arguments, true);

        if (!tags.length)
            return changed;

        for (let i = 0; i < tags.length; i++) {
            if (!this._index[tags[i]])
                continue;

            changed = true;

            delete this._index[tags[i]];
            this._list.splice(this._list.indexOf(tags[i]), 1);

            this.fire('remove', tags[i], this._parent);
        }

        if (changed)
            this.fire('change', this._parent);

        return changed;
    }

    /**
     * Remove all tags.
     *
     * @example
     * tags.clear();
     */
    clear() {
        if (!this._list.length)
            return;

        const tags = this._list.slice(0);
        this._list = [];
        this._index = { };

        for (let i = 0; i < tags.length; i++)
            this.fire('remove', tags[i], this._parent);

        this.fire('change', this._parent);
    }

    /**
     * Check if tags satisfy filters. Filters can be provided by simple name of tag, as well as by
     * array of tags. When an array is provided it will check if tags contain each tag within the
     * array. If any of comma separated argument is satisfied, then it will return true. Any number
     * of combinations are valid, and order is irrelevant.
     *
     * @param {...*} query - Name of a tag or array of tags.
     * @returns {boolean} True if filters are satisfied.
     * @example
     * tags.has('player'); // player
     * @example
     * tags.has('mob', 'player'); // player OR mob
     * @example
     * tags.has(['level-1', 'mob']); // monster AND level-1
     * @example
     * tags.has(['ui', 'settings'], ['ui', 'levels']); // (ui AND settings) OR (ui AND levels)
     */
    has() {
        if (!this._list.length)
            return false;

        return this._has(this._processArguments(arguments));
    }

    /**
     * @param {string[]|string[][]} tags - Array of tags.
     * @returns {boolean} True if the supplied tags are present.
     * @private
     */
    _has(tags) {
        if (!this._list.length || !tags.length)
            return false;

        for (let i = 0; i < tags.length; i++) {
            if (tags[i].length === 1) {
                // single occurrence
                if (this._index[tags[i][0]])
                    return true;
            } else {
                // combined occurrence
                let multiple = true;

                for (let t = 0; t < tags[i].length; t++) {
                    if (this._index[tags[i][t]])
                        continue;

                    multiple = false;
                    break;
                }

                if (multiple)
                    return true;
            }
        }

        return false;
    }

    /**
     * Returns immutable array of tags.
     *
     * @returns {string[]} Copy of tags array.
     */
    list() {
        return this._list.slice(0);
    }

    /**
     * @param {IArguments} args - Arguments to process.
     * @param {boolean} [flat] - If true, will flatten array of tags. Defaults to false.
     * @returns {string[]|string[][]} Array of tags.
     * @private
     */
    _processArguments(args, flat) {
        const tags = [];
        let tmp = [];

        if (!args || !args.length)
            return tags;

        for (let i = 0; i < args.length; i++) {
            if (args[i] instanceof Array) {
                if (!flat)
                    tmp = [];

                for (let t = 0; t < args[i].length; t++) {
                    if (typeof args[i][t] !== 'string')
                        continue;

                    if (flat) {
                        tags.push(args[i][t]);
                    } else {
                        tmp.push(args[i][t]);
                    }
                }

                if (!flat && tmp.length)
                    tags.push(tmp);
            } else if (typeof args[i] === 'string') {
                if (flat) {
                    tags.push(args[i]);
                } else {
                    tags.push([args[i]]);
                }
            }
        }

        return tags;
    }

    /**
     * Number of tags in set.
     *
     * @type {number}
     */
    get size() {
        return this._list.length;
    }
}

export { Tags };
