pc.extend(pc, (function () {
    var cmp, temp, pp, minEnd, maxEnd, sortCallback;

    function swap(array, i, j) {
        temp = array[i];
        array[i] = array[j];
        array[j] = temp;
        return array;
    }

    function partition(array, left, right) {
        cmp = array[right - 1];
        minEnd = left;
        for (maxEnd = left; maxEnd < right - 1; maxEnd += 1) {
            if (sortCallback(array[maxEnd], cmp) < 0) {
                swap(array, maxEnd, minEnd);
                minEnd += 1;
            }
        }
        swap(array, minEnd, right - 1);
        return minEnd;
    }

    function quickSort(array, left, right) {
        if (left < right) {
            pp = partition(array, left, right);
            quickSort(array, left, pp);
            quickSort(array, pp + 1, right);
        }
        return array;
    }

    return {
        /**
         * @private
         * @function
         * @name pc.partialSort
         * @description Sorts a part of array. Doesn't allocate additional memory.
         * @param {Array} arr Array
         * @param {Number} start First element
         * @param {Number} end Last element
         * @param {Function} [callback] Optional comparison function
         */
        partialSort: function(arr, start, end, callback) {
            sortCallback = callback;
            quickSort(arr, start, end);
        }
    };
}()));
