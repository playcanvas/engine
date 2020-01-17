Object.assign(pc, (function () {
    /**
     * @private
     * @class
     * @name pc.IndexedList
     * @classdesc A ordered list-type data structure that can provide item look up by key, but also return return a list.\
     */
    var IndexedList = function () {
        this._list = [];
        this._index = {};
    };

    Object.assign(IndexedList.prototype, {
        /**
         * @private
         * @function
         * @name pc.IndexedList#push
         * @description  Add a new item into the list with a index key
         * @param {string} key -  Key used to look up item in index
         * @param {object} item - Item to be stored
         */
        push: function (key, item) {
            if (this._index[key]) {
                throw Error("Key already in index " + key);
            }
            var location = this._list.push(item) - 1;
            this._index[key] = location;
        },

        /**
         * @private
         * @function
         * @name pc.IndexedList#has
         * @description Test whether a key has been added to the index
         * @param {string} key - The key to test
         * @returns {boolean} Returns true if key is in the index, false if not
         */
        has: function (key) {
            return this._index[key] !== undefined;
        },

        /**
         * @private
         * @function
         * @name pc.IndexedList#get
         * @description Return the item indexed by a key
         * @param {string} key - The key of the item to retrieve
         * @returns {object} The item stored at key
         */
        get: function (key) {
            var location = this._index[key];
            if (location !== undefined) {
                return this._list[location];
            }
            return null;
        },

        /**
         * @private
         * @function
         * @name pc.IndexedList#remove
         * @description Remove the item indexed by key from the list
         * @param {string} key - The key at which to remove the item
         * @returns {boolean} Returns true if the key exists and an item was removed, returns false if no item was removed
         */
        remove: function (key) {
            var location = this._index[key];
            if (location !== undefined) {
                this._list.splice(location, 1);
                delete this._index[key];

                // update index
                for (key in this._index) {
                    var idx = this._index[key];
                    if (idx > location) {
                        this._index[key] = idx - 1;
                    }
                }
                return true;
            }

            return false;
        },

        /**
         * @private
         * @function
         * @name pc.IndexedList#list
         * @description Returns the list of items
         * @returns {object[]} The list of items
         */
        list: function () {
            return this._list;
        },

        /**
         * @private
         * @function
         * @name pc.IndexedList#clear
         * @description Remove all items from the list
         */
        clear: function () {
            this._list.length = 0;

            for (var prop in this._index) {
                delete this._index[prop];
            }
        }
    });

    return {
        IndexedList: IndexedList
    };
}()));
