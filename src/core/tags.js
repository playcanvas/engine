import { EventHandler } from './event-handler.js';

/**
 * @class
 * @name pc.Tags
 * @augments pc.EventHandler
 * @classdesc Set of tag names.
 * @description Create an instance of a Tags.
 * @param {object} [parent] - Parent object who tags belong to.
 * Note: Tags are automatically available on `pc.Entity` and `pc.Asset` as `tags` field.
 */
class Tags extends EventHandler {
    constructor(parent) {
        super();

        this._index = { };
        this._list = [];
        this._parent = parent;
    }

    /**
     * @function
     * @name pc.Tags#add
     * @description Add a tag, duplicates are ignored. Can be array or comma separated arguments for multiple tags.
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
        var changed = false;
        var tags = this._processArguments(arguments, true);

        if (!tags.length)
            return changed;

        for (var i = 0; i < tags.length; i++) {
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
     * @function
     * @name pc.Tags#remove
     * @description Remove tag.
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
        var changed = false;

        if (!this._list.length)
            return changed;

        var tags = this._processArguments(arguments, true);

        if (!tags.length)
            return changed;

        for (var i = 0; i < tags.length; i++) {
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
     * @function
     * @name pc.Tags#clear
     * @description Remove all tags.
     * @example
     * tags.clear();
     */
    clear() {
        if (!this._list.length)
            return;

        var tags = this._list.slice(0);
        this._list = [];
        this._index = { };

        for (var i = 0; i < tags.length; i++)
            this.fire('remove', tags[i], this._parent);

        this.fire('change', this._parent);
    }

    /**
     * @function
     * @name pc.Tags#has
     * @description Check if tags satisfy filters.
     * Filters can be provided by simple name of tag, as well as by array of tags.
     * When an array is provided it will check if tags contain each tag within the array.
     * If any of comma separated argument is satisfied, then it will return true.
     * Any number of combinations are valid, and order is irrelevant.
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


    _has(tags) {
        if (!this._list.length || !tags.length)
            return false;

        for (var i = 0; i < tags.length; i++) {
            if (tags[i].length === 1) {
                // single occurance
                if (this._index[tags[i][0]])
                    return true;
            } else {
                // combined occurance
                var multiple = true;

                for (var t = 0; t < tags[i].length; t++) {
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
     * @function
     * @name pc.Tags#list
     * @description Returns immutable array of tags.
     * @returns {string[]} Copy of tags array.
     */
    list() {
        return this._list.slice(0);
    }

    _processArguments(args, flat) {
        var tags = [];
        var tmp = [];

        if (!args || !args.length)
            return tags;

        for (var i = 0; i < args.length; i++) {
            if (args[i] instanceof Array) {
                if (!flat)
                    tmp = [];

                for (var t = 0; t < args[i].length; t++) {
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
     * @field
     * @readonly
     * @name pc.Tags#size
     * @type {number}
     * @description Number of tags in set.
     */
    get size() {
        return this._list.length;
    }
}

/**
 * @event
 * @name pc.Tags#add
 * @param {string} tag - Name of a tag added to a set.
 * @param {object} parent - Parent object who tags belong to.
 */

/**
 * @event
 * @name pc.Tags#remove
 * @param {string} tag - Name of a tag removed from a set.
 * @param {object} parent - Parent object who tags belong to.
 */

/**
 * @event
 * @name pc.Tags#change
 * @param {object} [parent] - Parent object who tags belong to.
 * @description Fires when tags been added / removed.
 * It will fire once on bulk changes, while `add`/`remove` will fire on each tag operation.
 */

export { Tags };
