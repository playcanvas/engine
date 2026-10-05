/**
 * @import { MeshInstance } from '../mesh-instance.js'
 */

/**
 * Sorts lists of mesh instances for rendering, with a stable least significant digit radix sort
 * over 8 bit digits of any number of unsigned 32 bit integer keys per mesh instance. Its cost
 * grows linearly with the number of mesh instances, unlike a comparison sort, and the digits all
 * mesh instances share are skipped, so keys with few distinct values sort in a few passes.
 *
 * The buffers grow with the longest list sorted and are reused by all sorts, so the renderer
 * shares a single instance between its forward and shadow passes.
 *
 * @ignore
 */
class MeshInstanceSorter {
    /**
     * The key buffers, the least significant key first.
     *
     * @type {Uint32Array[]}
     * @private
     */
    _keys = [];

    /**
     * The order of the items being built, and the buffer each pass writes the new order to.
     *
     * @type {Uint32Array}
     * @private
     */
    _order = new Uint32Array(0);

    /** @private */
    _orderSwap = new Uint32Array(0);

    /**
     * The 256 entry histograms of the four digits of a key.
     *
     * @private
     */
    _histograms = new Uint32Array(1024);

    /**
     * The items in their sorted order, before they are copied back to the sorted array. Emptied
     * after each sort, so that it keeps no mesh instances alive.
     *
     * @type {Array<MeshInstance|null>}
     * @private
     */
    _sorted = [];

    /**
     * Sorts mesh instances by their forward sort key, then by their mesh, both descending, so that
     * the mesh instances sharing a material and a mesh are drawn together. See
     * MeshInstance#updateKey. Used for SORTMODE_MATERIALMESH and for shadow casters.
     *
     * @param {MeshInstance[]} meshInstances - The mesh instances to sort in place.
     */
    sortMaterialMesh(meshInstances) {
        const count = meshInstances.length;
        if (count < 2) {
            return;
        }

        const keys = this._prepare(count, 2);
        const meshKeys = keys[0];
        const materialKeys = keys[1];
        for (let i = 0; i < count; i++) {
            const meshInstance = meshInstances[i];

            // inverted, as the radix sort orders the keys ascending
            meshKeys[i] = ~meshInstance.mesh.id >>> 0;
            materialKeys[i] = ~meshInstance._sortKeyForward >>> 0;
        }

        this._sort(meshInstances, count, 2);
    }

    /**
     * Makes room for `numKeys` keys of `count` items, which the caller writes before calling
     * {@link MeshInstanceSorter#_sort}.
     *
     * @param {number} count - The number of items to sort.
     * @param {number} numKeys - The number of keys per item.
     * @returns {Uint32Array[]} The key buffers, the least significant key first.
     * @private
     */
    _prepare(count, numKeys) {
        const keys = this._keys;
        if (this._order.length < count) {
            const size = Math.max(count, this._order.length * 2, 64);
            this._order = new Uint32Array(size);
            this._orderSwap = new Uint32Array(size);
            keys.length = 0;
        }

        const size = this._order.length;
        while (keys.length < numKeys) {
            keys.push(new Uint32Array(size));
        }
        return keys;
    }

    /**
     * Sorts the items by the keys written after {@link MeshInstanceSorter#_prepare}, by the most
     * significant key, then by the next one, all ascending. Items with equal keys keep their
     * order.
     *
     * @param {MeshInstance[]} items - The items to sort in place.
     * @param {number} count - The number of items to sort, from the start of the array.
     * @param {number} numKeys - The number of keys per item.
     * @private
     */
    _sort(items, count, numKeys) {
        const order = this._order;
        for (let i = 0; i < count; i++) {
            order[i] = i;
        }

        // least significant first, each pass keeping the order of the previous one for equal digits
        const keys = this._keys;
        for (let k = 0; k < numKeys; k++) {
            this._sortByKey(keys[k], count);
        }

        // move the items to their sorted positions, and release the references to them
        const sorted = this._sorted;
        const result = this._order;
        for (let i = 0; i < count; i++) {
            sorted[i] = items[result[i]];
        }
        for (let i = 0; i < count; i++) {
            items[i] = sorted[i];
            sorted[i] = null;
        }
    }

    /**
     * Orders the item indices in {@link MeshInstanceSorter#_order} by one of the keys.
     *
     * @param {Uint32Array} keys - The key of each item.
     * @param {number} count - The number of items.
     * @private
     */
    _sortByKey(keys, count) {
        let order = this._order;
        let swap = this._orderSwap;

        // the histograms of all four digits of the key, which do not depend on the order
        const histograms = this._histograms;
        histograms.fill(0);
        for (let i = 0; i < count; i++) {
            const key = keys[i];
            histograms[key & 0xff]++;
            histograms[256 + ((key >>> 8) & 0xff)]++;
            histograms[512 + ((key >>> 16) & 0xff)]++;
            histograms[768 + (key >>> 24)]++;
        }

        for (let digit = 0; digit < 4; digit++) {
            const base = digit * 256;
            const shift = digit * 8;

            // a digit all items share leaves the order as it is
            if (histograms[base + ((keys[0] >>> shift) & 0xff)] === count) {
                continue;
            }

            // the first position of each digit value
            let offset = 0;
            for (let v = 0; v < 256; v++) {
                const n = histograms[base + v];
                histograms[base + v] = offset;
                offset += n;
            }

            for (let i = 0; i < count; i++) {
                const index = order[i];
                swap[histograms[base + ((keys[index] >>> shift) & 0xff)]++] = index;
            }

            const temp = order;
            order = swap;
            swap = temp;
        }

        this._order = order;
        this._orderSwap = swap;
    }
}

export { MeshInstanceSorter };
