Object.assign(pc, function () {
    'use strict';

    /**
    * @private
    * @name pc.SortedLoopArray
    * @class Helper class used to hold an array of items in a specific order. This array is safe to modify
    * while we loop through it. The class assumes that it holds objects that need to be sorted based on
    * one of their fields.
    * @param {Object} args Arguments
    * @param {String} args.sortBy The name of the field that each element in the array is going to be sorted by
    * @property {Number} loopIndex The current index used to loop through the array. This gets modified if we
    * add or remove elements from the array while looping. See the example to see how to loop through this array.
    * @property {Number} length The number of elements in the array.
    * @property {Object[]} items The internal array that holds the actual array elements.
    * @example
    * var array = new pc.SortedLoopArray({ sortBy: 'priority' });
    * array.insert(item); // adds item to the right slot based on item.priority
    * array.append(item); // adds item to the end of the array
    * array.remove(item); // removes item from array
    * for (array.loopIndex = 0; array.loopIndex < array.length; array.loopIndex++) {
    *   // do things with array elements
    *   // safe to remove and add elements into the array while looping
    * }
    */

    var SortedLoopArray = function (args) {
        this._sortBy = args.sortBy;
        this.items = [];
        this.length = 0;
        this.loopIndex = -1;
    };

    /**
     * @private
     * Searches for the right spot to insert the specified item
     * @param {Object} item The item
     * @returns {Number} The index where to insert the item
     */
    SortedLoopArray.prototype._binarySearch = function (item) {
        var left = 0;
        var right = this.items.length - 1;
        var search = item[this._sortBy];

        var middle;
        var current;
        while (left <= right) {
            middle = Math.floor((left + right) / 2);
            current = this.items[middle][this._sortBy];
            if (current <= search) {
                left = middle + 1;
            } else if (current > search) {
                right = middle - 1;
            }
        }

        return left;
    };

    /**
     * @private
     * Inserts the specified item into the array at the right
     * index based on the 'sortBy' field passed into the constructor. This
     * also adjusts the loopIndex accordingly.
     * @param {Object} item The item to insert
     */
    SortedLoopArray.prototype.insert = function (item) {
        var index = this._binarySearch(item);
        this.items.splice(index, 0, item);
        this.length++;
        if (this.loopIndex >= index) {
            this.loopIndex++;
        }
    };

    /**
     * @private
     * Appendss the specified item to the end of the array. Faster than insert()
     * as it does not binary search for the right index. This also adjusts
     * the loopIndex accordingly.
     * @param {Object} item The item to append
     */
    SortedLoopArray.prototype.append = function (item) {
        this.items.push(item);
        this.length++;
    };

    /**
     * @private
     * Removes the specified item from the array.
     * @param {Object} item The item to remove
     */
    SortedLoopArray.prototype.remove = function (item) {
        var idx = this.items.indexOf(item);
        if (idx < 0) return;

        this.items.splice(idx, 1);
        this.length--;
        if (this.loopIndex >= idx) {
            this.loopIndex--;
        }
    };

    return {
        SortedLoopArray: SortedLoopArray
    };

}());
